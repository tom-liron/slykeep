"use server";

import { z } from "zod";

import { isItemTypeName } from "@/config/item-type-catalog";
import {
    DESCRIPTION_INSTRUCTIONS,
    DESCRIPTION_MAX_OUTPUT_TOKENS,
    buildDescriptionInput,
    hasDescribableContent,
    parseSuggestedDescription,
} from "@/lib/ai-description";
import {
    EXPLAIN_INSTRUCTIONS,
    EXPLAIN_MAX_OUTPUT_TOKENS,
    EXPLAIN_REASONING_EFFORT,
    buildExplainInput,
    hasExplainableContent,
    isExplainableType,
    parseExplanation,
} from "@/lib/ai-explain";
import {
    OPTIMIZE_INSTRUCTIONS,
    OPTIMIZE_MAX_OUTPUT_TOKENS,
    buildOptimizeInput,
    hasOptimizableContent,
    isOptimizablePromptType,
    isUnchanged,
    parseOptimizedPrompt,
} from "@/lib/ai-optimize";
import { TAG_INSTRUCTIONS, buildTagInput, parseSuggestedTags } from "@/lib/ai-tags";
import { AI_PAYLOAD_LIMIT } from "@/lib/ai-text";
import { canUseAi } from "@/lib/limits";
import { AI_MODEL, openai } from "@/lib/openai";
import { type RateLimitName, checkRateLimit, minutesUntilReset } from "@/lib/rate-limit";
import { getCurrentUser } from "@/server/current-user";
import type {
    ExplainCodeResult,
    ItemDraft,
    OptimizePromptResult,
    SuggestDescriptionResult,
    SuggestTagsResult,
} from "@/types/ai";

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
const itemDraftSchema = z.object({
    title: z.string().max(AI_PAYLOAD_LIMIT).optional(),
    content: z.string().max(AI_PAYLOAD_LIMIT).optional(),
    url: z.string().max(AI_PAYLOAD_LIMIT).optional(),
    fileName: z.string().max(AI_PAYLOAD_LIMIT).optional(),
    language: z.string().max(AI_PAYLOAD_LIMIT).optional(),
    tags: z.string().max(AI_PAYLOAD_LIMIT).optional(),
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
 * Shared by all four actions rather than written out each time: the order is invisible in the return value —
 * every step returns the same shape — so a copy that reordered two lines would keep every test that
 * only asserts `success` green while changing what the action actually protects.
 *
 * `feature` names the thing in both messages, which is why it is a plural noun phrase: "AI *tag
 * suggestions* require a Pro subscription", "you have used all your *explanations*".
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
 * Explains the code or command an item holds, for the person reading it.
 *
 * The third AI action and the first that runs over an item being **read** rather than written,
 * which is the one thing that makes it different from its two neighbours. Everything else is
 * theirs: a Server Action because the caller needs the prose or a sentence explaining its absence,
 * the same guards in the same order, its own rate-limit bucket.
 *
 * It still takes an `ItemDraft` rather than an item id, and that is not laziness about the read
 * case. Passing an id would mean this action re-reading a body the drawer has already fetched and
 * is displaying — a second query to answer a question about text that is on screen — and it would
 * make the explanation describe the stored row rather than what the user is looking at. The drawer
 * hands over what it rendered.
 *
 * The **type gate is enforced here, not only hidden in the UI.** A free-text type would otherwise be
 * an opening to write the model's instructions from the client — `buildExplainInput` interpolates
 * it — and beyond that, "explain this" over a note or a link is a different feature with a
 * different prompt, not this one with a wider audience. Unlike the other two actions, which drop an
 * unrecognized type and ask anyway, an unexplainable type is a refusal: there is no useful request
 * left once it is removed.
 */
export async function explainCode(input: ItemDraft): Promise<ExplainCodeResult> {
    const { id: userId, isPro } = await getCurrentUser();

    const parsed = itemDraftSchema.safeParse(input);

    if (!parsed.success) {
        return { success: false, error: "That item could not be read." };
    }

    const draft = parsed.data;

    if (!isExplainableType(draft.type)) {
        return { success: false, error: "Only snippets and commands can be explained." };
    }

    if (!hasExplainableContent(draft)) {
        return { success: false, error: "There is no code here to explain." };
    }

    const guard = await guardAiRequest(isPro, userId, "aiExplain", "explanations");

    if (!guard.ok) return { success: false, error: guard.error };

    try {
        // No `text.format` on this one, unlike the two above — the answer *is* the response, in
        // markdown, so there is no field to pull out of a wrapper. See `parseExplanation`.
        const response = await openai().responses.create({
            model: AI_MODEL,
            instructions: EXPLAIN_INSTRUCTIONS,
            input: buildExplainInput(draft),
            max_output_tokens: EXPLAIN_MAX_OUTPUT_TOKENS,
            // The only call of the three that sets this. See the constant for why this one.
            reasoning: { effort: EXPLAIN_REASONING_EFFORT },
        });

        // Checked for the same reason `generateDescription` checks it, and it matters more here:
        // this call sets the higher ceiling *and* asks for the longest answer, so it is the one most
        // likely to hit it. What arrives is an explanation that stops mid-sentence, which reads as a
        // confident account that simply ends — worse than no answer, because nothing marks it short.
        if (response.status === "incomplete") {
            return { success: false, error: "That explanation was cut short. Try again." };
        }

        const explanation = parseExplanation(response.output_text ?? "");

        // Nothing usable is a failure, not an empty success — a tab that appears holding nothing
        // reads as broken rather than as a model with nothing to say.
        if (explanation === null) {
            return { success: false, error: "No explanation could be written for this code." };
        }

        return { success: true, data: { explanation } };
    } catch (error) {
        return { success: false, error: failure(error, "Explanations") };
    }
}

/**
 * Rewrites a saved prompt to be clearer and more specific, for the person about to reuse it.
 *
 * The fourth AI action, and structurally the closest to `explainCode`: it runs over an item being
 * **read** rather than written, it takes the drawer's rendered draft rather than an item id, and its
 * type gate is a refusal rather than a dropped field — an unoptimizable type leaves no useful
 * request behind once it is removed.
 *
 * Two things make it its own thing rather than explain with a different prompt.
 *
 * **It is the one AI feature whose input is itself a prompt.** A stashed prompt saying "ignore all
 * previous instructions" is ordinary content here, not a contrived attack, and `OPTIMIZE_INSTRUCTIONS`
 * documents what is done about it inside the request. What actually contains it is downstream of
 * this action: the result is shown to the user for review, never executed and never fed onward, and
 * `content` is only written if they click accept. This action writes nothing.
 *
 * **It can succeed by changing nothing.** `unchanged` is a success, not a failure — the model read
 * the prompt and had nothing worth changing, which is what a good prompt should get. Reporting it as
 * an error would tell the user something went wrong when the opposite did.
 */
export async function optimizePrompt(input: ItemDraft): Promise<OptimizePromptResult> {
    const { id: userId, isPro } = await getCurrentUser();

    const parsed = itemDraftSchema.safeParse(input);

    if (!parsed.success) {
        return { success: false, error: "That prompt could not be read." };
    }

    const draft = parsed.data;

    if (!isOptimizablePromptType(draft.type)) {
        return { success: false, error: "Only prompts can be optimized." };
    }

    if (!hasOptimizableContent(draft)) {
        return { success: false, error: "There is no prompt here to optimize." };
    }

    const guard = await guardAiRequest(isPro, userId, "aiOptimize", "prompt optimizations");

    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const response = await openai().responses.create({
            model: AI_MODEL,
            instructions: OPTIMIZE_INSTRUCTIONS,
            input: buildOptimizeInput(draft),
            // Wrapped, unlike explain and like the two writing actions: this answer has two parts,
            // so there is a field to pull out rather than a whole response to take.
            text: { format: { type: "json_object" } },
            max_output_tokens: OPTIMIZE_MAX_OUTPUT_TOKENS,
            // Left at the default `medium`, unlike explain. That one dialled the thinking back
            // because the thinking was what kept running out; rewriting is a harder task than
            // labelling and an easier one than reading unfamiliar code, and a shallow rewrite is a
            // worse outcome here than a slow one — the user is being asked to replace their own
            // text with it.
        });

        // The worst output this feature can produce: a rewrite that stops early still looks like a
        // finished prompt, and the accept button would save it over the original.
        if (response.status === "incomplete") {
            return { success: false, error: "That optimization was cut short. Try again." };
        }

        const optimized = parseOptimizedPrompt(response.output_text ?? "");

        if (optimized === null) {
            return { success: false, error: "No optimization could be written for this prompt." };
        }

        return {
            success: true,
            data: {
                ...optimized,
                // Compared against the draft the request was built from, not against whatever the
                // model was shown — a long prompt is truncated before it reaches the model, so
                // comparing against the truncated copy would report "unchanged" for a rewrite that
                // silently drops the tail of the user's prompt.
                unchanged: isUnchanged(draft.content ?? "", optimized.prompt),
            },
        };
    } catch (error) {
        return { success: false, error: failure(error, "Prompt optimizations") };
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
