"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma-client/client";
import {
    createCollectionSchema,
    updateCollectionSchema,
    type CreateCollectionInput,
    type UpdateCollectionInput,
} from "@/lib/collection-schemas";
import { fieldErrorsOf } from "@/lib/field-errors";
import { FREE_COLLECTION_LIMIT, canCreateCollection } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getCurrentUserId } from "@/server/current-user";
import type {
    CreateCollectionResult,
    DeleteCollectionResult,
    ToggleCollectionFavoriteResult,
    UpdateCollectionResult,
} from "@/types/collection";

/**
 * Prisma's "no record matched the `where`" code, raised by `update` and `delete` when nothing was
 * found. Restated rather than imported from `actions/items.ts`, which declares the same constant: a
 * `"use server"` module may only export async functions, so there is nothing to import.
 */
const RECORD_NOT_FOUND = "P2025";

/**
 * Creates a collection from the top bar's dialog.
 *
 * A Server Action rather than a route handler, by the standards' rule: the dialog needs the outcome
 * and nothing more — it shows a toast and closes, and never reads an HTTP status. That is the same
 * call `createItem` makes, and the opposite of registration, which is a route precisely because its
 * client has to tell a 400 from a 409.
 *
 * The write lives here rather than in `server/collections.ts`, which stays read-only: `server/` owns
 * reads and `actions/` owns writes (`project-overview.md` §9).
 *
 * `userId` comes from the session and is never read from the payload, so a collection can only ever
 * be created for the signed-in user — the same rule the read side follows by scoping every query to
 * `getCurrentUserId()`. It is resolved before the parse, so an unauthenticated caller is turned away
 * without the input being looked at.
 *
 * The free tier's cap of three is checked below, at the write boundary — the UI may show the cap,
 * but this is the authority. It refuses for real: `canCreateCollection` short-circuits on
 * `ENFORCE_PRO_LIMITS`, which has been on since Phase 6.
 */
export async function createCollection(
    input: CreateCollectionInput,
): Promise<CreateCollectionResult> {
    const userId = await getCurrentUserId();

    const parsed = createCollectionSchema.safeParse(input);

    if (!parsed.success) {
        const fields = fieldErrorsOf(parsed.error);

        return {
            success: false,
            error: Object.values(fields)[0] ?? "Check the highlighted fields and try again.",
            fields,
        };
    }

    // The same shape `createItem` uses, and the same accepted race: the count is read outside a
    // transaction, so two concurrent creates can both see two and both write.
    const { isPro } = await getCurrentUser();
    const collectionCount = await prisma.collection.count({ where: { userId } });

    if (!canCreateCollection(isPro, collectionCount)) {
        return {
            success: false,
            error: `Free accounts can have ${FREE_COLLECTION_LIMIT} collections. Upgrade to Pro in Settings for unlimited.`,
        };
    }

    try {
        const collection = await prisma.collection.create({
            data: {
                ...parsed.data,
                user: { connect: { id: userId } },
            },
            select: { id: true },
        });

        return { success: true, data: { id: collection.id } };
    } catch (error) {
        console.error("Collection create failed:", error);

        return { success: false, error: "Could not create this collection. Try again." };
    }
}

/**
 * Edits a collection's metadata from the edit dialog, wherever it was opened from — the collection's
 * own page, or a card's menu on the dashboard or `/collections`.
 *
 * The ownership check is the `where`, not a check on what came back: `{ id, userId }` means another
 * user's collection is refused by the same path as an id that does not exist, so neither confirms
 * the other. That is the rule `updateItem` follows and the read side follows in
 * `getCollectionPageData` — and it matters more here than on create, where the owner could only ever
 * be the session's. An id reaches this action from a card the user was served, so it is client input
 * by the time it arrives, and a hand-made call could name any collection in the database.
 *
 * `parsed.data` is spread rather than the raw input, so the write is limited to the two columns the
 * contract declares — `isFavorite` and `defaultTypeId` are not editable here, and a payload naming
 * them is stripped before it reaches Prisma.
 */
export async function updateCollection(
    collectionId: string,
    input: UpdateCollectionInput,
): Promise<UpdateCollectionResult> {
    const userId = await getCurrentUserId();

    const parsed = updateCollectionSchema.safeParse(input);

    if (!parsed.success) {
        const fields = fieldErrorsOf(parsed.error);

        return {
            success: false,
            error: Object.values(fields)[0] ?? "Check the highlighted fields and try again.",
            fields,
        };
    }

    try {
        await prisma.collection.update({
            where: { id: collectionId, userId },
            data: { ...parsed.data },
        });

        return { success: true };
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === RECORD_NOT_FOUND
        ) {
            return { success: false, error: "This collection no longer exists." };
        }

        console.error("Collection update failed:", error);

        return { success: false, error: "Could not save your changes. Try again." };
    }
}

/**
 * Favourites or unfavourites a collection, from the card menu or the collection page's header.
 *
 * **Takes the state to write, rather than flipping what it finds.** The name is the course's, so its
 * lesson logic still transfers, but the signature deliberately is not: reading the row and writing
 * `!isFavorite` is two statements with a gap between them, and two clicks that overlap in that gap
 * both read the same value and write the same one — the second click does nothing, and the star ends
 * up disagreeing with the database. Sending the wanted state makes the write idempotent: clicking
 * favourite twice writes `true` twice, which is the same row either way, and there is nothing to
 * read first. The `where` is what makes it safe, exactly as in `updateCollection` — another user's
 * id is refused by the same path as one that does not exist.
 *
 * `updatedAt` moves as a side effect of this write, via Prisma's `@updatedAt`. That is deliberate and
 * `/favorites` depends on it: with no favourited-at column, ordering by `updatedAt` is what puts a
 * just-favourited collection at the top of the list. It also means an unrelated rename reorders that
 * list, which is the limit of what this ordering can promise (`project-overview.md` §11).
 */
export async function toggleCollectionFavorite(
    collectionId: string,
    isFavorite: boolean,
): Promise<ToggleCollectionFavoriteResult> {
    const userId = await getCurrentUserId();

    let updated: { isFavorite: boolean };

    try {
        updated = await prisma.collection.update({
            where: { id: collectionId, userId },
            data: { isFavorite },
            select: { isFavorite: true },
        });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === RECORD_NOT_FOUND
        ) {
            return { success: false, error: "This collection no longer exists." };
        }

        console.error("Collection favorite toggle failed:", error);

        return { success: false, error: "Could not update this collection. Try again." };
    }

    // The same layout-wide revalidation `deleteCollection` explains at length, for the same reason:
    // the sidebar's favourites list sits in the dashboard layout, above every route in the group, so
    // a caller's own `router.refresh()` cannot reach it from a page — and this write is precisely a
    // write to that list.
    revalidatePath("/", "layout");

    return { success: true, data: { isFavorite: updated.isFavorite } };
}

/**
 * Deletes a collection, and only the collection.
 *
 * The items inside it survive — that is the whole point of the confirmation in front of this, and it
 * needs no code here to be true. `ItemCollection` declares `onDelete: Cascade` on its *collection*
 * side, so removing this row drops the membership rows that pointed at it and nothing else; `Item`
 * is never touched, and an item filed in two collections is still in the other one. Nothing below
 * may be changed into a nested delete of `items` without breaking that promise.
 *
 * A hard delete, like `deleteItem`: there is no `deletedAt` column and no trash view, which is why
 * the dialog says the action cannot be undone. Soft delete remains an open question
 * (`project-overview.md` §11) and would be a schema change rather than a change here.
 */
export async function deleteCollection(collectionId: string): Promise<DeleteCollectionResult> {
    const userId = await getCurrentUserId();

    try {
        await prisma.collection.delete({ where: { id: collectionId, userId } });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === RECORD_NOT_FOUND
        ) {
            return { success: false, error: "This collection no longer exists." };
        }

        console.error("Collection delete failed:", error);

        return { success: false, error: "Could not delete this collection. Try again." };
    }

    // A collection is rendered by the dashboard *layout* as well as by its pages — the sidebar's
    // favourites and recents sit above every route in the group. A client `router.refresh()` covers
    // that only for a caller that stays where it is; the one that navigates away cannot refresh at
    // all (it would re-render the route it is leaving, which now 404s — see `DeleteCollectionDialog`),
    // and a plain navigation re-renders the page it lands on *without* re-rendering the layout it
    // shares with the page it left. That is how a deleted collection kept its place in the sidebar.
    // Revalidating the root layout invalidates the client router cache for the whole group, so the
    // navigation that follows re-fetches both.
    //
    // Outside the `try`, like `deleteItem`'s R2 cleanup and for the same reason: the row is already
    // gone and the user's request succeeded, so a failure here must not be reported as a delete that
    // did not happen.
    revalidatePath("/", "layout");

    return { success: true };
}
