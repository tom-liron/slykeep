"use server";

import { ITEM_TYPE_CATALOG, isItemTypeName } from "@/config/item-type-catalog";
import { fieldFailure } from "@/lib/field-errors";
import { FILE_CONSTRAINTS, extensionOf, isFileItemTypeName } from "@/lib/file-constraints";
import {
    createItemSchema,
    itemTypeOwns,
    normalizeTagName,
    updateItemSchema,
    type CreateItemInput,
    type UpdateItemInput,
} from "@/lib/item-schemas";
import { FREE_ITEM_LIMIT, canAccessItemType, canCreateItem } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import { deleteObject, isOwnedKey } from "@/lib/r2";
import { getCurrentUser, getCurrentUserId } from "@/server/current-user";
import { getItemDetail } from "@/server/items";
import { isRecordNotFound } from "@/server/prisma-errors";
import type {
    CreateItemResult,
    DeleteItemResult,
    ToggleItemFavoriteResult,
    ToggleItemPinResult,
    UpdateItemResult,
} from "@/types/item";

/**
 * Moves `updatedAt` on the collections an item write just affected.
 *
 * Every "recent collections" listing orders by that column, but membership lives in
 * `item_collections` and is written as a nested write on the **Item** — so Postgres never touches the
 * `collections` row, and `updatedAt` sat equal to `createdAt` for every collection nobody had
 * renamed. "Recent" therefore meant "newest", and the one thing that did move it was a rename, which
 * is metadata rather than activity. This is what makes the column mean what §8 always claimed.
 *
 * Deliberately a write rather than a read-time aggregate: deriving recency from the greatest of the
 * collection's own timestamp, its items' and `ItemCollection.addedAt` would put a joined aggregate no
 * index can serve into the `ORDER BY` of two queries that run on every dashboard page view, to save
 * one `UPDATE` on a path that is already writing. See `project-overview.md` §11.
 *
 * Scoped to the owner even though every caller has already established ownership — the ids reaching
 * a bulk `updateMany` are worth pinning to the account at the statement itself.
 *
 * Best-effort: the item write it follows has already succeeded and been reported, so a failure here
 * costs a sidebar ordering, not the user's work. Failing the action would be a lie about what
 * happened.
 */
async function touchCollections(collectionIds: readonly string[], userId: string): Promise<void> {
    if (collectionIds.length === 0) return;

    try {
        await prisma.collection.updateMany({
            where: { id: { in: [...collectionIds] }, userId },
            // Written by hand even though `updatedAt` is `@updatedAt`: Prisma only moves that column
            // for a row it is actually updating, and "touch this row and change nothing else" needs
            // something in `data` to be an update at all.
            data: { updatedAt: new Date() },
        });
    } catch (error) {
        console.error("Could not update collection recency:", error);
    }
}

/**
 * How both write paths point at a tag: by `(userId, normalized)`, never by name.
 *
 * The compound unique is the whole scoping guarantee at the write boundary — a bare `{ name }` no
 * longer identifies a row, and if it somehow still compiled it would connect whichever account's tag
 * matched first. Curried over `userId` so neither call site can forget to pass it.
 */
const tagRef = (userId: string) => (name: string) => ({
    userId_normalized: { userId, normalized: normalizeTagName(name) },
});

/**
 * Whether every submitted collection id belongs to the signed-in user.
 *
 * The ids reach the server the same way `fileKey` does — chosen from a list this account was served,
 * then posted back — so by the time they arrive they are client input again, and a hand-made payload
 * could name a collection belonging to someone else. Nothing else on the write path would catch it:
 * `ItemCollection` has no `userId` of its own, so the insert would happily file this user's item into
 * a stranger's collection, and the stranger's collection page would then render it.
 *
 * Counting is enough, and is one query: the ids are already de-duplicated by the schema, so a count
 * short of the list means at least one of them is not theirs — or does not exist, which is
 * deliberately the same answer, so an id cannot be probed for.
 */
async function ownsEveryCollection(collectionIds: string[], userId: string) {
    const owned = await prisma.collection.count({
        where: { id: { in: collectionIds }, userId },
    });

    return owned === collectionIds.length;
}

/** What both actions report when an id in the payload is not one of the caller's collections. */
const UNKNOWN_COLLECTION = {
    error: "One of those collections no longer exists.",
    fields: { collectionIds: "One of those collections no longer exists." },
} as const;

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
        return fieldFailure(parsed.error);
    }

    const { type, tags, collectionIds, ...columns } = parsed.data;

    // The free tier's cap, enforced at the write boundary — the same division `contentType` follows:
    // the UI may *show* the cap (the profile page renders both totals), but the action is the
    // authority. A hard block rather than a nag, because the pricing page promises "Up to 50 items"
    // and a 51st that succeeds turns the number into decoration.
    //
    // A race is accepted here: two concurrent creates can both read 49 and both write. Closing it
    // needs a transaction with a re-count on the hottest write path in the app, which is not worth
    // it for a soft cap — but it is a decision rather than an oversight.
    const { isPro } = await getCurrentUser();
    const itemCount = await prisma.item.count({ where: { userId } });

    if (!canCreateItem(isPro, itemCount)) {
        return {
            success: false,
            error: `Free accounts can hold ${FREE_ITEM_LIMIT} items. Upgrade to Pro in Settings for unlimited.`,
        };
    }

    if (collectionIds?.length && !(await ownsEveryCollection(collectionIds, userId))) {
        return { success: false, ...UNKNOWN_COLLECTION };
    }

    if (columns.fileKey) {
        // The same entitlement the upload route checked, re-checked at the write: an upload and a
        // create are two requests, and only this one decides what the account ends up holding.
        // `isPro` is already in hand from the cap check above — `getCurrentUser` is request-cached,
        // so it was one query either way.
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
            // Same "ensure these exist" as `updateItem`. Tags are per-account now, so a name another
            // user coined is *not* a duplicate — `skipDuplicates` fires on this user's own
            // `@@unique([userId, normalized])`, which is also what makes re-typing `React` when
            // `react` is already held a no-op rather than a second row.
            await prisma.tag.createMany({
                data: tags.map((name) => ({ name, normalized: normalizeTagName(name), userId })),
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
                tags: tags?.length ? { connect: tags.map(tagRef(userId)) } : undefined,
                // `create` rather than `connect`, because `ItemCollection` is an explicit join
                // model: what is being made here is the membership row itself, and its `itemId` is
                // the item this same statement is writing. Nested, so an item is never left created
                // but unfiled by a second statement that failed.
                collections: collectionIds?.length
                    ? { create: collectionIds.map((collectionId) => ({ collectionId })) }
                    : undefined,
            },
            select: { id: true },
        });

        // Filing an item into a collection is activity for that collection.
        await touchCollections(collectionIds ?? [], userId);

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
        return fieldFailure(parsed.error);
    }

    const { tags, collectionIds, title, description, content, url, language } = parsed.data;

    if (collectionIds?.length && !(await ownsEveryCollection(collectionIds, userId))) {
        return { success: false, ...UNKNOWN_COLLECTION };
    }

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
            select: {
                itemType: { select: { name: true } },
                // The membership *before* the edit, which is half of what recency needs: a collection
                // the item leaves has changed exactly as much as the one it joins, and after the
                // write there is nothing left to say it was ever a member.
                collections: { select: { collectionId: true } },
            },
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

        // Tag rows have to exist before the relation can point at them, and `skipDuplicates` is what
        // makes this an "ensure these exist" rather than an insert. It fires on this account's own
        // `@@unique([userId, normalized])` — another user holding the same name is irrelevant now.
        if (tags?.length) {
            await prisma.tag.createMany({
                data: tags.map((name) => ({ name, normalized: normalizeTagName(name), userId })),
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
                // This is one of exactly two writes to `editedAt` — the other is `createItem`. It is
                // set by hand rather than declared `@updatedAt` in the schema precisely so that the
                // favourite and pin toggles cannot move it: those write a boolean, not an edit, and
                // the recency listings order by this column. `updatedAt` still moves everywhere.
                editedAt: new Date(),
                // `set` replaces the whole relation in one operation: everything currently attached
                // is disconnected and exactly this list is connected. An empty array is meaningful
                // (clear every tag); `undefined` leaves the relation alone.
                tags: tags && { set: tags.map(tagRef(userId)) },
                // Membership is replaced with exactly what was submitted, but not by clearing and
                // re-inserting: the rows that survive keep their `addedAt`, which is the only thing
                // recording when an item was filed somewhere.
                //
                // The two halves work on disjoint sets — one deletes what is no longer selected, the
                // other inserts what is newly selected and skips what is already there — so they
                // hold whichever order Prisma runs them in. `undefined` leaves the relation alone,
                // exactly as it does for tags.
                collections: collectionIds && {
                    // An empty selection is meaningful: remove the item from every collection. It is
                    // written as an empty `where` rather than `notIn: []` so that "delete all of
                    // them" is stated rather than inferred from how a database treats `NOT IN ()`.
                    deleteMany: collectionIds.length
                        ? { collectionId: { notIn: collectionIds } }
                        : {},
                    createMany: collectionIds.length
                        ? {
                              data: collectionIds.map((collectionId) => ({ collectionId })),
                              skipDuplicates: true,
                          }
                        : undefined,
                },
            },
        });

        // The union of where the item was and where it now is. Both halves matter and for different
        // reasons: a collection it *left* changed as much as one it joined, and when the payload
        // carries no membership at all (`collectionIds` undefined, the relation untouched) editing
        // the item is still activity for every collection holding it. That is the case a naive
        // `touchCollections(collectionIds)` would miss — and it is the common one, since most edits
        // are to content rather than to filing.
        await touchCollections(
            [
                ...new Set([
                    ...existing.collections.map((row) => row.collectionId),
                    ...(collectionIds ?? []),
                ]),
            ],
            userId,
        );
    } catch (error) {
        if (isRecordNotFound(error)) {
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
 * Favourites or unfavourites an item from the detail drawer.
 *
 * Takes the state to write rather than flipping what it finds, for the reasons set out in
 * `toggleCollectionFavorite` — the write is idempotent, needs no read in front of it, and cannot be
 * raced into disagreeing with the star that triggered it. Ownership is the `where`, so an item that
 * is not the caller's is refused exactly as one that does not exist.
 *
 * No re-read afterwards, unlike `updateItem`: that one returns the whole detail because the drawer
 * re-renders its body from what came back, while this touches one boolean the caller is already
 * rendering. `updatedAt` still moves, via `@updatedAt`, which is what surfaces a just-favourited item
 * at the top of `/favorites`.
 *
 * And no `revalidatePath` either, where `toggleCollectionFavorite` has one — not an oversight. That
 * one writes to a list the dashboard *layout* renders (the sidebar's favourites), which a caller's
 * `router.refresh()` cannot reach from inside a page. Nothing in the layout renders an item's star:
 * every surface that does — the cards, the dashboard's favourite count, `/favorites` itself — is part
 * of the page the drawer is open over, so refreshing the route is enough and re-fetching the whole
 * group's layout data on every star click would not buy anything.
 */
export async function toggleItemFavorite(
    itemId: string,
    isFavorite: boolean,
): Promise<ToggleItemFavoriteResult> {
    const userId = await getCurrentUserId();

    try {
        const updated = await prisma.item.update({
            where: { id: itemId, userId },
            data: { isFavorite },
            select: { isFavorite: true },
        });

        return { success: true, data: { isFavorite: updated.isFavorite } };
    } catch (error) {
        if (isRecordNotFound(error)) {
            return { success: false, error: "This item no longer exists." };
        }

        console.error("Item favorite toggle failed:", error);

        return { success: false, error: "Could not update this item. Try again." };
    }
}

/**
 * Pins or unpins an item from the detail drawer.
 *
 * The same write as `toggleItemFavorite` on a different column, and deliberately so — the state to
 * write arrives from the caller, ownership is the `where`, and a missing row and someone else's row
 * give the same answer. The two are kept as separate actions rather than one parameterised toggle:
 * the column would then be a string from the client, which is a wider door than two boolean writes.
 *
 * Pinning is what `Item.isPinned` was waiting for. The column has been persisted and rendered — the
 * cards' pin indicator, the dashboard's Pinned section — since before anything could write it.
 *
 * `updatedAt` moves here, and `editedAt` deliberately does not — pinning is not editing. That is what
 * keeps this write out of every recency ordering in the app, including the dashboard's Recent list,
 * which pinned items now appear in alongside everything else. The earlier version of this note argued
 * the same conclusion from the lists being disjoint; they no longer are, and the column split is the
 * better reason anyway, since it holds for every listing rather than for one query's `where`.
 *
 * `pinnedAt` is written in the same statement as the boolean, and cleared to `null` on unpin. Two
 * columns rather than one nullable timestamp doing both jobs, so that `isPinned` stays the thing
 * every listing filters and sorts on without having to reason about NULLs — but they are only ever
 * consistent because this one write sets both, the same boundary rule `contentType` relies on. It
 * also means an unpin genuinely forgets when the item was pinned: re-pinning it puts it at the top
 * of the section, not back where it used to sit, which is the reading a user would expect.
 */
export async function toggleItemPin(
    itemId: string,
    isPinned: boolean,
): Promise<ToggleItemPinResult> {
    const userId = await getCurrentUserId();

    try {
        const updated = await prisma.item.update({
            where: { id: itemId, userId },
            data: { isPinned, pinnedAt: isPinned ? new Date() : null },
            select: { isPinned: true },
        });

        return { success: true, data: { isPinned: updated.isPinned } };
    } catch (error) {
        if (isRecordNotFound(error)) {
            return { success: false, error: "This item no longer exists." };
        }

        console.error("Item pin toggle failed:", error);

        return { success: false, error: "Could not update this item. Try again." };
    }
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
    let collectionIds: string[] = [];

    try {
        // Read before the delete, unlike `fileKey`, which the delete hands back. It has to be: the
        // `item_collections` rows cascade with the item, so afterwards there is nothing left to say
        // which collections it belonged to. The race this opens — membership changing between the
        // two statements — costs at most a stale sidebar ordering.
        collectionIds = (
            await prisma.itemCollection.findMany({
                where: { itemId, item: { userId } },
                select: { collectionId: true },
            })
        ).map((row) => row.collectionId);

        // Ownership in the `where` for the same reason `updateItem` puts it there: another user's id
        // is rejected by the same path as one that does not exist, so neither confirms the other.
        // The deleted row comes back, which is where the key to clean up comes from — reading it
        // beforehand would be a second query and a window in which the row could change.
        ({ fileKey } = await prisma.item.delete({
            where: { id: itemId, userId },
            select: { fileKey: true },
        }));
    } catch (error) {
        if (isRecordNotFound(error)) {
            return { success: false, error: "This item no longer exists." };
        }

        console.error("Item delete failed:", error);

        return { success: false, error: "Could not delete this item. Try again." };
    }

    // Removing an item from a collection is activity for it, exactly as adding one is.
    await touchCollections(collectionIds, userId);

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
