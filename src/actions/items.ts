"use server";

import { z } from "zod";

import { Prisma } from "@/generated/prisma-client/client";
import { updateItemSchema, type UpdateItemInput } from "@/lib/item-schemas";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/server/current-user";
import { getItemDetail } from "@/server/items";
import type { DeleteItemResult, UpdateItemResult } from "@/types/item";

/** Prisma's "no record matched the `where`" code, raised by `update` when nothing was found. */
const RECORD_NOT_FOUND = "P2025";

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
        const fieldErrors = z.flattenError(parsed.error).fieldErrors;

        // The toast needs one sentence; the inputs need their own messages. Both come from the same
        // parse, so there is no second set of rules to keep in step.
        const fields = Object.fromEntries(
            Object.entries(fieldErrors).map(([field, messages]) => [field, messages?.[0]]),
        );

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
