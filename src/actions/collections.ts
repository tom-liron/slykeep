"use server";

import { createCollectionSchema, type CreateCollectionInput } from "@/lib/collection-schemas";
import { fieldErrorsOf } from "@/lib/field-errors";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/server/current-user";
import type { CreateCollectionResult } from "@/types/collection";

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
 * Nothing here caps how many collections an account may hold. The free tier's limit of three is
 * Phase 6 work and `ENFORCE_PRO_LIMITS` is still false, so a check added now would be one that
 * enforces nothing — `canAccessItemType` is the pattern to follow when that switch is flipped.
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
