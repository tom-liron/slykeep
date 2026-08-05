"use server";

import { z } from "zod";

import { ITEM_TYPE_CATALOG } from "@/config/item-type-catalog";
import { Prisma } from "@/generated/prisma-client/client";
import {
    createItemSchema,
    updateItemSchema,
    type CreateItemInput,
    type UpdateItemInput,
} from "@/lib/item-schemas";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/server/current-user";
import { getItemDetail } from "@/server/items";
import type { CreateItemResult, DeleteItemResult, UpdateItemResult } from "@/types/item";

/** Prisma's "no record matched the `where`" code, raised by `update` when nothing was found. */
const RECORD_NOT_FOUND = "P2025";

/**
 * The first message reported against each field, keyed by field name — the toast needs one sentence
 * and the inputs need their own messages, and both come from this one parse, so there is no second
 * set of rules to keep in step. Read off `issues` rather than `z.flattenError`, whose field map is
 * typed from the schema's input and degrades to `any` once a helper accepts more than one schema.
 */
function fieldErrorsOf(error: z.ZodError): Record<string, string> {
    const fields: Record<string, string> = {};

    for (const issue of error.issues) {
        const [field] = issue.path;

        if (typeof field === "string" && !(field in fields)) {
            fields[field] = issue.message;
        }
    }

    return fields;
}

/**
 * Creates an item from the top bar's dialog.
 *
 * Three things the payload is deliberately not trusted with. `userId` comes from the session, so an
 * item can only ever be created for the signed-in user. The item type's id is looked up from the
 * submitted *name* — never accepted directly — with `findFirst({ name, userId: null })` rather than
 * `findUnique`: `name` type-checks as unique because of the partial index, but it is unique only
 * among system rows, and a user's custom type may one day share it. And `contentType` is read from
 * the catalog, so it always agrees with the type — the schema has already dropped whichever content
 * columns that type does not own, which is what keeps the two from contradicting each other.
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

    const { tags, ...columns } = parsed.data;

    try {
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
            // rule `getItemDetail` follows, for the same reason.
            where: { id: itemId, userId },
            data: {
                ...columns,
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
 */
export async function deleteItem(itemId: string): Promise<DeleteItemResult> {
    const userId = await getCurrentUserId();

    try {
        // Ownership in the `where` for the same reason `updateItem` puts it there: another user's id
        // is rejected by the same path as one that does not exist, so neither confirms the other.
        await prisma.item.delete({ where: { id: itemId, userId } });
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

    return { success: true };
}
