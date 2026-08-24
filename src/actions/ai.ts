"use server";

import { z } from "zod";

import { isItemTypeName } from "@/config/item-type-catalog";
import {
    AI_DESCRIPTION_PAYLOAD_LIMIT,
    DESCRIPTION_INSTRUCTIONS,
    DESCRIPTION_MAX_OUTPUT_TOKENS,
    buildDescriptionInput,
    hasDescribableContent,
    parseSuggestedDescription,
} from "@/lib/ai-description";
import {
    AI_TAG_PAYLOAD_LIMIT,
    TAG_INSTRUCTIONS,
    buildTagInput,
    parseSuggestedTags,
} from "@/lib/ai-tags";
import { canUseAi } from "@/lib/limits";
import { AI_MODEL, openai } from "@/lib/openai";
import { type RateLimitName, checkRateLimit, minutesUntilReset } from "@/lib/rate-limit";
import { getCurrentUser } from "@/server/current-user";
import type { ItemDraft, SuggestDescriptionResult, SuggestTagsResult } from "@/types/ai";

/**
 * What the AI buttons may ask about.
 *
 * The item's *draft*, not its id — deliberately. The create dialog has no item yet, and the edit
 * form's fields have been typed into since the row was read, so an answer built from the stored
 * copy would describe the version on screen only by coincidence. Nothing here is stored or trusted
 * with anything: it is shown to the model and thrown away.
 *
 * Every field is optional and none is trimmed into a requirement by the schema — an item with a
 * title and no body is perfectly describable, and so is the reverse, and a file item has neither a
 * body nor a URL. What is *not* acceptable is a draft with nothing in it at all, which each action
 * checks after parsing rather than as a schema rule, because the message for it is an instruction
 * to the user rather than a field error.
 *
 * The per-field cap is a bound on what a hand-made request can make the server hold in memory
 * before the prompt builders' truncation gets to run, not a product limit — an item's content is
 * not capped anywhere.
 */
const PAYLOAD_LIMIT = Math.min(AI_TAG_PAYLOAD_LIMIT, AI_DESCRIPTION_PAYLOAD_LIMIT);

const itemDraftSchema = z.object({
    title: z.string().max(PAYLOAD_LIMIT).optional(),
    content: z.string().max(PAYLOAD_LIMIT).optional(),
    url: z.string().max(PAYLOAD_LIMIT).optional(),
    fileName: z.string().max(PAYLOAD_LIMIT).optional(),
    language: z.string().max(PAYLOAD_LIMIT).optional(),
    tags: z.string().max(PAYLOAD_LIMIT).optional(),
    /**
     * Accepted as a string here and checked against the catalog below rather than constrained by
     * the schema, because the two disagree about what an unrecognized value means. It is
     * interpolated into the prompt, so a free-text type is an opening to write the model's
     * instructions from the client and the allow-list is not optional — but a type this build does
     * not know is a reason to ask without it, not a reason to refuse the whole request.
     */
    type: z.string().optional(),
});

/**
 * Everything that has to be true before a paid call is made, in the order it has to be true in.
 *
 * The order is the point, and it is the one `createItem` uses. Authentication first, so nothing
 * below it can run for a stranger — that is the caller's, since both actions need the user for more
 * than the guard. Validation next, so the entitlement check is reading a shape rather than a guess.
 * **The Pro gate before the rate limit**, so a free account is refused without spending a token out
 * of a budget it was never entitled to use — a refusal that consumed their hourly allowance would
 * be a limit on people who cannot make the call at all.
 *
 * Shared by both actions rather than written twice: the order is invisible in the return value —
 * every step returns the same shape — so a copy that reordered two lines would keep every test that
 * only asserts `success` green while changing what the action actually protects.
 *
 * `feature` names the thing in both messages, which is why it is a plural noun phrase: "AI *tag
 * suggestions* require a Pro subscription", "you have used all your *descriptions*".
 */
async function guardAiRequest(
    isPro: boolean,
    userId: string,
    bucket: RateLimitName,
    feature: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!canUseAi(isPro)) {
        return {
            ok: false,
            error: `AI ${feature} require a Pro subscription. Upgrade in Settings.`,
        };
    }

    const limit = await checkRateLimit(bucket, userId);

    if (!limit.success) {
        const minutes = minutesUntilReset(limit.reset);

        return {
            ok: false,
            error: `You have used all your ${feature} for now. Try again in ${minutes} minute${
                minutes === 1 ? "" : "s"
            }.`,
        };
    }

    return { ok: true };
}

/** The catalog name, or nothing — see the schema's note on why this is not a schema rule. */
function knownType(type: string | undefined): string | undefined {
    return type && isItemTypeName(type) ? type : undefined;
}

/**
 * Suggests three to five tags for the item being written.
 *
 * A Server Action rather than a route handler, per the rule in `project-overview.md` §9: the caller
 * needs the tags or a sentence explaining their absence, and no HTTP status it could read would
 * tell it anything the union does not.
 *
 * The URL and the filename stand in for the content column the type does not have, which is what
 * lets a link or an image be tagged from the only text it has. They are folded together here rather
 * than by the caller, so the forms hand both AI buttons one unmodified draft.
 */
export async function generateAutoTags(input: ItemDraft): Promise<SuggestTagsResult> {
    const { id: userId, isPro } = await getCurrentUser();

    const parsed = itemDraftSchema.safeParse(input);

    if (!parsed.success) {
        return { success: false, error: "That item could not be read for tagging." };
    }

    const draft = parsed.data;
    const title = draft.title?.trim() ?? "";
    const content = draft.content?.trim() || draft.url?.trim() || draft.fileName?.trim() || "";

    if (!title && !content) {
        return { success: false, error: "Add a title or some content first." };
    }

    const guard = await guardAiRequest(isPro, userId, "aiTag", "tag suggestions");

    if (!guard.ok) return { success: false, error: guard.error };

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
            input: buildTagInput({ title, content, type: knownType(draft.type) }),
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
        return { success: false, error: failure(error, "Tag suggestions") };
    }
}

/**
 * Writes a one-or-two-sentence description of the item being written.
 *
 * The same guards in the same order as tagging, and its own rate-limit bucket. The draft goes to
 * the prompt builder whole rather than folded down: a link's URL and a file's name are what that
 * type has *instead* of a body, and the description is allowed to say so — see `ItemDraft`.
 */
export async function generateDescription(input: ItemDraft): Promise<SuggestDescriptionResult> {
    const { id: userId, isPro } = await getCurrentUser();

    const parsed = itemDraftSchema.safeParse(input);

    if (!parsed.success) {
        return { success: false, error: "That item could not be read." };
    }

    const draft = { ...parsed.data, type: knownType(parsed.data.type) };

    if (!hasDescribableContent(draft)) {
        return { success: false, error: "Add a title or some content first." };
    }

    const guard = await guardAiRequest(isPro, userId, "aiDescribe", "descriptions");

    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const response = await openai().responses.create({
            model: AI_MODEL,
            instructions: DESCRIPTION_INSTRUCTIONS,
            input: buildDescriptionInput(draft),
            text: { format: { type: "json_object" } },
            max_output_tokens: DESCRIPTION_MAX_OUTPUT_TOKENS,
        });

        // Checked here and not in the tagging path above, because this is the call that sets a
        // bound: a response can only be cut short against a ceiling it was given. What arrives with
        // this status is a half-written sentence, and half a sentence about an item says something
        // the model did not say — so it is refused rather than parsed.
        if (response.status === "incomplete") {
            return { success: false, error: "That description was cut short. Try again." };
        }

        const description = parseSuggestedDescription(response.output_text ?? "");

        // Nothing usable is a failure, not an empty success — a button that clears its own pending
        // state and changes nothing else reads as broken rather than as a model with nothing to say.
        if (description === null) {
            return { success: false, error: "No description could be written for this item." };
        }

        return { success: true, data: { description } };
    } catch (error) {
        return { success: false, error: failure(error, "Descriptions") };
    }
}

/**
 * What the user is told when the SDK throws.
 *
 * Logged rather than surfaced. The SDK's errors name the model, the request id, and sometimes the
 * key's organization, none of which belongs in a toast — and the user's options are the same
 * whichever of them it was.
 */
function failure(error: unknown, subject: string): string {
    console.error(`AI request failed (${subject}):`, error);

    return `${subject} are unavailable right now. Try again.`;
}
