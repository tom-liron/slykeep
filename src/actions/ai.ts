"use server";

import { z } from "zod";

import { isItemTypeName } from "@/config/item-type-catalog";
import {
    AI_TAG_PAYLOAD_LIMIT,
    TAG_INSTRUCTIONS,
    buildTagInput,
    parseSuggestedTags,
} from "@/lib/ai-tags";
import { canUseAi } from "@/lib/limits";
import { AI_MODEL, openai } from "@/lib/openai";
import { checkRateLimit, minutesUntilReset } from "@/lib/rate-limit";
import { getCurrentUser } from "@/server/current-user";
import type { SuggestTagsResult } from "@/types/ai";

/**
 * What the button may ask about.
 *
 * The item's *draft*, not its id — deliberately. The create dialog has no item yet, and the edit
 * form's fields have been typed into since the row was read, so tags suggested from the stored copy
 * would describe the version on screen only by coincidence. Nothing here is stored or trusted with
 * anything: it is shown to the model and thrown away.
 *
 * Both text fields are optional and neither is trimmed into a requirement here — an item with a
 * title and no body is perfectly taggable, and so is the reverse. What is *not* acceptable is both
 * empty, which the action checks after parsing rather than as a schema rule, because the message
 * for it is an instruction to the user rather than a field error.
 */
const suggestTagsSchema = z.object({
    title: z.string().max(AI_TAG_PAYLOAD_LIMIT).optional(),
    content: z.string().max(AI_TAG_PAYLOAD_LIMIT).optional(),
    /**
     * Accepted as a string here and checked against the catalog below rather than constrained by
     * the schema, because the two disagree about what an unrecognized value means. It is
     * interpolated into the prompt, so a free-text type is an opening to write the model's
     * instructions from the client and the allow-list is not optional — but a type this build does
     * not know is a reason to ask without it, not a reason to refuse the whole request.
     */
    type: z.string().optional(),
});

export type SuggestTagsInput = z.infer<typeof suggestTagsSchema>;

/**
 * Suggests three to five tags for the item being written.
 *
 * The guard order is the one `createItem` uses, and the order is the point. Authentication first,
 * so nothing below it can run for a stranger. Validation next, so the entitlement check is reading
 * a shape rather than a guess. **The Pro gate before the rate limit**, so a free account is refused
 * without spending a token out of a budget it was never entitled to use — a refusal that consumed
 * their hourly allowance would be a limit on people who cannot make the call at all. The model call
 * is last, and is the only step that costs money; everything above it is there to make sure it is
 * reached only by someone allowed to reach it.
 *
 * A Server Action rather than a route handler, per the rule in `project-overview.md` §9: the caller
 * needs the tags or a sentence explaining their absence, and no HTTP status it could read would
 * tell it anything the union does not.
 */
export async function generateAutoTags(input: SuggestTagsInput): Promise<SuggestTagsResult> {
    const { id: userId, isPro } = await getCurrentUser();

    const parsed = suggestTagsSchema.safeParse(input);

    if (!parsed.success) {
        return { success: false, error: "That item could not be read for tagging." };
    }

    if (!canUseAi(isPro)) {
        return {
            success: false,
            error: "AI tag suggestions require a Pro subscription. Upgrade in Settings.",
        };
    }

    // Dropped unless the catalog recognizes it — see the schema's note on why this is here and
    // not there.
    const itemType =
        parsed.data.type && isItemTypeName(parsed.data.type) ? parsed.data.type : undefined;

    const title = parsed.data.title?.trim() ?? "";
    const content = parsed.data.content?.trim() ?? "";

    if (!title && !content) {
        return { success: false, error: "Add a title or some content first." };
    }

    const limit = await checkRateLimit("aiTag", userId);

    if (!limit.success) {
        const minutes = minutesUntilReset(limit.reset);

        return {
            success: false,
            error: `You have used all your tag suggestions for now. Try again in ${minutes} minute${
                minutes === 1 ? "" : "s"
            }.`,
        };
    }

    try {
        // The Responses API, not Chat Completions: `gpt-5-nano` returns empty content from
        // `chat.completions.create()`, so the older call compiles, runs, costs money, and yields
        // nothing. `output_text` is where the body is.
        //
        // `json_object` rather than a Zod-backed structured schema — the strict-schema mode spends
        // a great many tokens on this model and runs into the length limit before it finishes the
        // answer, so the parsing is done by hand in `parseSuggestedTags` instead.
        const response = await openai().responses.create({
            model: AI_MODEL,
            instructions: TAG_INSTRUCTIONS,
            input: buildTagInput({ title, content, type: itemType }),
            text: { format: { type: "json_object" } },
        });

        const tags = parseSuggestedTags(response.output_text ?? "");

        // An empty list is a failure from here, not an empty success. The button's whole promise is
        // suggestions, and badges that never appear with no message beside them reads as a broken
        // control rather than as a model that had nothing to say.
        if (tags.length === 0) {
            return { success: false, error: "No tags could be suggested for this item." };
        }

        return { success: true, data: { tags } };
    } catch (error) {
        // Logged rather than surfaced. The SDK's errors name the model, the request id, and
        // sometimes the key's organization, none of which belongs in a toast — and the user's
        // options are the same whichever of them it was.
        console.error("AI tag suggestion failed:", error);

        return { success: false, error: "Tag suggestions are unavailable right now. Try again." };
    }
}
