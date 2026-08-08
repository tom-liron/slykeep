"use server";

import { ITEM_TYPE_CATALOG, isItemTypeName } from "@/config/item-type-catalog";
import { Prisma } from "@/generated/prisma-client/client";
import { fieldErrorsOf } from "@/lib/field-errors";
import { FILE_CONSTRAINTS, extensionOf, isFileItemTypeName } from "@/lib/file-constraints";
import {
    createItemSchema,
    itemTypeOwns,
    updateItemSchema,
    type CreateItemInput,
    type UpdateItemInput,
} from "@/lib/item-schemas";
import { canAccessItemType } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import { deleteObject, isOwnedKey } from "@/lib/r2";
import { getCurrentUser, getCurrentUserId } from "@/server/current-user";
import { getItemDetail } from "@/server/items";
import type { CreateItemResult, DeleteItemResult, UpdateItemResult } from "@/types/item";

/** Prisma's "no record matched the `where`" code, raised by `update` when nothing was found. */
const RECORD_NOT_FOUND = "P2025";

/**
 * Creates an item from the top bar's dialog.
 *
 * Four things the payload is deliberately not trusted with. `userId` comes from the session, so an
 * item can only ever be created for the signed-in user. The item type's id is looked up from the
 * submitted *name* — never accepted directly — with `findFirst({ name, userId: null })` rather than
 * `findUnique`: `name` type-checks as unique because of the partial index, but it is unique only
 * among system rows, and a user's custom type may one day share it. And `contentType` is read from
 * the catalog, so it always agrees with the type — the schema has already dropped whichever content
 * columns that type does not own, which is what keeps the two from contradicting each other.
 *
 * The fourth is the R2 key. `POST /api/upload` hands one to the browser, and the browser hands it
 * back here with the rest of the form — so it is client input again by the time it arrives, and a
 * hand-made payload could name someone else's object. `isOwnedKey` re-derives who it belongs to from
 * the session rather than taking the round trip's word for it.
 */
export async function createItem(input: CreateItemInput): Promise<CreateItemResult> {
    const userId = await getCurrentUserId();

    const parsed = createItemSchema.safeParse(input);

    if (!parsed.success) {
        const fields = fieldErrorsOf(parsed.error);

        return {
            success: false,
            error: Object.values(fields)[0] ?? "Check the highlighted fields and try again.",
            fields,
        };
    }

    const { type, tags, ...columns } = parsed.data;

    if (columns.fileKey) {
        // The same entitlement the upload route checked, re-checked at the write: an upload and a
        // create are two requests, and only this one decides what the account ends up holding.
        const { isPro } = await getCurrentUser();

        if (!canAccessItemType(isPro, ITEM_TYPE_CATALOG[type].isPro)) {
            return { success: false, error: "File items require a Pro subscription." };
        }

        if (!isOwnedKey(columns.fileKey, userId)) {
            return {
                success: false,
                error: "That upload could not be verified. Try uploading the file again.",
                fields: { fileKey: "That upload could not be verified." },
            };
        }

        // The name travels back from the browser beside the key, so it is client input in the same
        // way — and it is not decoration. `Item.fileName` is what `isInlineDisposition` reads to
        // decide whether `GET /api/files/[id]` answers `inline`, while the media type comes from the
        // stored object. Upload a real `.svg` (an allowed image format) and then claim
        // `fileName: "x.png"`, and the route serves `image/svg+xml` inline on this origin — which is
        // precisely the case the `.svg` exception exists to prevent, and one `nosniff` cannot help
        // with, because the declared type is the truth about those bytes.
        //
        // `buildObjectKey` already put the uploaded file's real extension on the end of the key, so
        // the two only have to be made to agree. The upload route validated the extension it was
        // given; this pins the name to that same object.
        const claimed = extensionOf(columns.fileName ?? "");

        if (
            claimed !== extensionOf(columns.fileKey) ||
            !isFileItemTypeName(type) ||
            !(FILE_CONSTRAINTS[type].extensions as readonly string[]).includes(claimed)
        ) {
            return {
                success: false,
                error: "That upload could not be verified. Try uploading the file again.",
                fields: { fileKey: "That upload could not be verified." },
            };
        }
    }

    try {
        const itemType = await prisma.itemType.findFirst({
            where: { name: type, userId: null },
            select: { id: true },
        });

        if (!itemType) {
            console.error(`Missing system item type: ${type}`);

            return { success: false, error: "That item type is unavailable right now." };
        }

        if (tags?.length) {
            // Same "ensure these exist" as `updateItem`: `Tag.name` is globally unique, so a name
            // another user already coined is a duplicate rather than a fresh row.
            await prisma.tag.createMany({
                data: tags.map((name) => ({ name })),
                skipDuplicates: true,
            });
        }

        const item = await prisma.item.create({
            data: {
                ...columns,
                contentType: ITEM_TYPE_CATALOG[type].contentType,
                user: { connect: { id: userId } },
                itemType: { connect: { id: itemType.id } },
                // `connect` rather than the `set` an edit uses: a row that does not exist yet has no
                // relation to replace.
                tags: tags?.length ? { connect: tags.map((name) => ({ name })) } : undefined,
            },
            select: { id: true },
        });

        return { success: true, data: { id: item.id } };
    } catch (error) {
        console.error("Item create failed:", error);

        return { success: false, error: "Could not create this item. Try again." };
    }
}

/**
 * Edits an item from the detail drawer.
 *
 * A Server Action rather than a route handler, by the standards' rule: the drawer needs the outcome
 * and the updated item, never an HTTP status. That is the same call `changePassword` makes, and the
 * opposite of `GET /api/items/[id]`, which exists because the drawer's *read* has to tell a 404 from
 * a retryable failure.
 *
 * The write lives here rather than in `server/items.ts`, which stays read-only — `server/` owns
 * reads and `actions/` owns writes (`project-overview.md` §9), which is why `account.ts` also calls
 * `prisma` directly.
 *
 * Like `createItem`, this refuses to write a content column the item's type does not own, so
 * `contentType` and the populated column cannot be made to contradict each other. It costs a read of
 * the item's type, because an edit payload does not carry one — see below.
 */
export async function updateItem(
    itemId: string,
    input: UpdateItemInput,
): Promise<UpdateItemResult> {
    const userId = await getCurrentUserId();

    const parsed = updateItemSchema.safeParse(input);

    if (!parsed.success) {
        const fields = fieldErrorsOf(parsed.error);

        return {
            success: false,
            error: Object.values(fields)[0] ?? "Check the highlighted fields and try again.",
            fields,
        };
    }

    const { tags, title, description, content, url, language } = parsed.data;

    try {
        // The item's type is what says which content columns it has, and an edit payload never
        // carries one — the type is not editable, deliberately. So it is read here rather than
        // inferred from which fields arrived. `createItemSchema` does the same stripping in a
        // `.transform()`, which it can only do because the create dialog submits the type; this read
        // is the equivalent step for the one path that does not.
        //
        // Scoped to the signed-in user for the same reason the `update` below is: a row that is not
        // theirs must be indistinguishable from one that does not exist.
        const existing = await prisma.item.findFirst({
            where: { id: itemId, userId },
            select: { itemType: { select: { name: true } } },
        });

        if (!existing) {
            return { success: false, error: "This item no longer exists." };
        }

        if (!isItemTypeName(existing.itemType.name)) {
            // Unreachable while every type is a seeded system row. Refusing rather than writing what
            // it can is deliberate: nothing here knows what a custom type owns, and the alternative
            // is silently dropping the edit to a column that may well exist.
            return { success: false, error: "This item's type cannot be edited yet." };
        }

        const owns = itemTypeOwns(existing.itemType.name);

        // Tag rows have to exist before the relation can point at them, and `Tag.name` is globally
        // unique, so a name another user already coined is a duplicate rather than a fresh row —
        // `skipDuplicates` is what makes this an "ensure these exist" rather than an insert.
        if (tags?.length) {
            await prisma.tag.createMany({
                data: tags.map((name) => ({ name })),
                skipDuplicates: true,
            });
        }

        await prisma.item.update({
            // Ownership sits in the `where`, not in a check on the result, so another user's item is
            // never loaded and their id is indistinguishable from one that does not exist — the same
            // rule `getItemDetail` follows, for the same reason. Kept here as well as on the read
            // above, so the authorization does not depend on that read having happened.
            where: { id: itemId, userId },
            data: {
                title,
                description,
                // A column the type does not own is `undefined`, which Prisma skips — the same
                // absent-versus-empty split the create path makes, and the reason a hand-made
                // payload cannot put a URL on a snippet and make `contentType` a lie. Every field
                // is named rather than spread, so a column added to the schema has to be considered
                // here instead of flowing straight through.
                content: owns.content ? content : undefined,
                url: owns.url ? url : undefined,
                language: owns.language ? language : undefined,
                // `set` replaces the whole relation in one operation: everything currently attached
                // is disconnected and exactly this list is connected. An empty array is meaningful
                // (clear every tag); `undefined` leaves the relation alone.
                tags: tags && { set: tags.map((name) => ({ name })) },
            },
        });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === RECORD_NOT_FOUND
        ) {
            return { success: false, error: "This item no longer exists." };
        }

        console.error("Item update failed:", error);

        return { success: false, error: "Could not save your changes. Try again." };
    }

    // Re-read rather than assemble a view model from the payload: `updatedAt` is set by the
    // database, and the drawer renders the item's collections, which this action never touched.
    const detail = await getItemDetail(itemId);

    if (!detail) {
        return { success: false, error: "This item no longer exists." };
    }

    return { success: true, data: detail };
}

/**
 * Deletes an item from the detail drawer.
 *
 * A hard delete: there is no `deletedAt` column and no trash view, which is why the dialog in front
 * of this says so. Soft delete is still an open question (`project-overview.md` §11) and would be a
 * schema change, not a change here.
 *
 * One `delete` covers the whole row. `ItemCollection` declares `onDelete: Cascade` on its item side,
 * and the implicit `ItemTags` join table cascades the same way, so the join rows go with the item
 * without a transaction. `Tag` rows themselves survive — they are global and shared across users.
 *
 * A file item's R2 object goes with it, after the row rather than before. There is no transaction
 * spanning Postgres and R2, so one of the two failure modes has to be chosen: delete the object
 * first and a failed row delete leaves an item pointing at nothing, which the drawer and the preview
 * both surface to the user; delete it second and a failed object delete leaves an orphan nobody can
 * see. The orphan is the cheaper mistake, so it is the one this takes — logged, never raised.
 */
export async function deleteItem(itemId: string): Promise<DeleteItemResult> {
    const userId = await getCurrentUserId();

    let fileKey: string | null = null;

    try {
        // Ownership in the `where` for the same reason `updateItem` puts it there: another user's id
        // is rejected by the same path as one that does not exist, so neither confirms the other.
        // The deleted row comes back, which is where the key to clean up comes from — reading it
        // beforehand would be a second query and a window in which the row could change.
        ({ fileKey } = await prisma.item.delete({
            where: { id: itemId, userId },
            select: { fileKey: true },
        }));
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === RECORD_NOT_FOUND
        ) {
            return { success: false, error: "This item no longer exists." };
        }

        console.error("Item delete failed:", error);

        return { success: false, error: "Could not delete this item. Try again." };
    }

    if (fileKey) {
        try {
            await deleteObject(fileKey);
        } catch (error) {
            // The item is already gone and the user's request succeeded. Reporting a failure here
            // would be a lie about what happened, and there is nothing they could do about it.
            console.error(`Orphaned R2 object after deleting item ${itemId}: ${fileKey}`, error);
        }
    }

    return { success: true };
}
