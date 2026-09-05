"use server";

import { revalidatePath } from "next/cache";

import {
    createCollectionSchema,
    updateCollectionSchema,
    type CreateCollectionInput,
    type UpdateCollectionInput,
} from "@/lib/collection-schemas";
import { fieldFailure } from "@/lib/field-errors";
import { FREE_COLLECTION_LIMIT, canCreateCollection } from "@/lib/limits";
import { prisma } from "@/server/infra/prisma";
import { getCurrentUser, getCurrentUserId } from "@/server/current-user";
import { isRecordNotFound } from "@/server/prisma-errors";
import type {
    CreateCollectionResult,
    DeleteCollectionResult,
    ToggleCollectionFavoriteResult,
    UpdateCollectionResult,
} from "@/types/collection";

/**
 * The collection write path: create, rename, favourite and delete.
 *
 * The boundary between the collection UI and Prisma. `CreateCollectionDialog`,
 * `EditCollectionDialog`, `DeleteCollectionDialog` and the favourite stars call these actions, which
 * authenticate the caller, validate the payload against `lib/collection-schemas.ts`, and perform the
 * write. `server/collections.ts` stays read-only — `server/` owns reads and `actions/` owns writes.
 *
 * @remarks
 * Two rules run through every action here. Ownership lives in the `where` (`{ id, userId }`) rather
 * than in a check on the result, so another user's collection is refused by the same path as an id
 * that does not exist and neither confirms the other. And `userId` always comes from the session,
 * never from the payload.
 */

/**
 * Creates a collection from the top bar's dialog.
 *
 * @remarks
 * The session is resolved before the parse, so an unauthenticated caller is turned away without the
 * input being looked at.
 *
 * The free tier's cap is checked here, at the write boundary: the UI may show the cap, but this is
 * the authority, and {@link canCreateCollection} refuses for real. The count is read outside a
 * transaction, so two concurrent creates can both see two and both write — the same accepted race
 * `createItem` documents.
 */
export async function createCollection(
    input: CreateCollectionInput,
): Promise<CreateCollectionResult> {
    const userId = await getCurrentUserId();

    const parsed = createCollectionSchema.safeParse(input);

    if (!parsed.success) {
        return fieldFailure(parsed.error);
    }

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
 * Edits a collection's name and description, from wherever the edit dialog was opened — the
 * collection's own page, or a card's menu on the dashboard or `/collections`.
 *
 * @remarks
 * The ownership `where` matters more here than on create, where the owner could only ever have been
 * the session's: an id reaches this action from a card the user was served, so it is client input by
 * the time it arrives and a hand-made call could name any collection in the database.
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
        return fieldFailure(parsed.error);
    }

    try {
        await prisma.collection.update({
            where: { id: collectionId, userId },
            data: { ...parsed.data },
        });

        return { success: true };
    } catch (error) {
        if (isRecordNotFound(error)) {
            return { success: false, error: "This collection no longer exists." };
        }

        console.error("Collection update failed:", error);

        return { success: false, error: "Could not save your changes. Try again." };
    }
}

/**
 * Favourites or unfavourites a collection, from the card menu or the collection page's header.
 *
 * @param isFavorite - The state to write, rather than a signal to flip what is stored. Reading the
 * row and writing `!isFavorite` is two statements with a gap between them, and two clicks overlapping
 * in that gap both read the same value and write the same one — leaving the star disagreeing with
 * the database. Sending the wanted state makes the write idempotent and needs no read in front of it.
 *
 * @remarks
 * `updatedAt` moves as a side effect, via Prisma's `@updatedAt`, and `/favorites` depends on it:
 * with no favourited-at column, ordering by `updatedAt` is what puts a just-favourited collection at
 * the top of the list. It also means an unrelated rename reorders that list, which is the limit of
 * what this ordering can promise.
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
        if (isRecordNotFound(error)) {
            return { success: false, error: "This collection no longer exists." };
        }

        console.error("Collection favorite toggle failed:", error);

        return { success: false, error: "Could not update this collection. Try again." };
    }

    // The layout-wide revalidation `deleteCollection` explains, for the same reason: the sidebar's
    // favourites list sits in the dashboard layout, above every route in the group, so a caller's
    // own `router.refresh()` cannot reach it from a page — and this write is a write to that list.
    revalidatePath("/", "layout");

    return { success: true, data: { isFavorite: updated.isFavorite } };
}

/**
 * Deletes a collection, and only the collection.
 *
 * The items inside it survive, which is what the confirmation in front of this promises.
 * `ItemCollection` declares `onDelete: Cascade` on its *collection* side, so removing this row drops
 * the membership rows pointing at it and nothing else; `Item` is never touched, and an item filed in
 * two collections is still in the other one.
 *
 * @remarks
 * Nothing below may become a nested delete of `items` without breaking that promise.
 *
 * A hard delete, like `deleteItem`: there is no `deletedAt` column and no trash view, which is why
 * the dialog says the action cannot be undone.
 */
export async function deleteCollection(collectionId: string): Promise<DeleteCollectionResult> {
    const userId = await getCurrentUserId();

    try {
        await prisma.collection.delete({ where: { id: collectionId, userId } });
    } catch (error) {
        if (isRecordNotFound(error)) {
            return { success: false, error: "This collection no longer exists." };
        }

        console.error("Collection delete failed:", error);

        return { success: false, error: "Could not delete this collection. Try again." };
    }

    // A collection is rendered by the dashboard *layout* as well as by its pages — the sidebar's
    // favourites and recents sit above every route in the group. A client `router.refresh()` covers
    // that only for a caller that stays where it is; the one that navigates away cannot refresh at
    // all, and a plain navigation re-renders the page it lands on *without* re-rendering the layout
    // it shares with the page it left. Revalidating the root layout invalidates the client router
    // cache for the whole group, so the navigation that follows re-fetches both.
    //
    // Outside the `try`, like `deleteItem`'s R2 cleanup: the row is already gone and the user's
    // request succeeded, so a failure here must not be reported as a delete that did not happen.
    revalidatePath("/", "layout");

    return { success: true };
}
