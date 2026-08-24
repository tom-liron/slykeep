/**
 * What the AI actions hand back.
 *
 * Lives here rather than beside the action for the reason `UpdateItemResult` and
 * `AccountActionState` do: a `"use server"` module may only export async functions.
 *
 * The same discriminated-union shape the item mutations use, so a caller that has checked `success`
 * reads `data` without a second null check. Every failure is a sentence meant for a toast — the
 * caller never branches on *which* failure, because a Pro gate, a spent budget, and a model that
 * returned nothing all end the same way: the suggestions did not arrive, and the message says why.
 */
export type SuggestTagsResult =
    { success: true; data: { tags: string[] } } | { success: false; error: string };
