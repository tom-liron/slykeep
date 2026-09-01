import { truncateForModel } from "@/lib/ai-text";
import type { ItemDraft } from "@/types/ai";

/**
 * The rules around the description model call: what it is shown, and what is trusted from what it
 * says back.
 *
 * Pure functions in `lib/` beside `ai-tags.ts`, for the same two reasons that file gives — a
 * `"use server"` module may only export async functions, and these are the halves that can be wrong
 * without failing to compile, so they belong somewhere a unit test can reach without a network.
 */

/**
 * How much of an item's body the model is shown.
 *
 * The same cap tagging uses, and the same reasoning: input is billed by the token, a stashed file
 * can be very long, and the head of the content is what says what the thing is. Stated here rather
 * than imported from `ai-tags.ts` because the two are equal by coincidence, not by rule — a
 * description could want more context than a label does, and the day it does, that is a number to
 * change here and not a shared constant to argue about.
 */
export const AI_DESCRIPTION_CONTENT_LIMIT = 2000;

/**
 * The longest description that will be accepted back.
 *
 * Generous on purpose: two sentences of English is 150 to 250 characters, so this is roughly double
 * what the prompt asks for. It is a guard against a model that ignored the instruction outright,
 * not a trim — which is why a longer response is **rejected** rather than cut. Cutting would hand
 * back half a sentence, and half a sentence about an item says something the model did not say. The
 * user sees "no description could be suggested" and clicks again, which is the honest outcome.
 *
 * There is no matching rule in `item-schemas.ts` to line this up with: `description` is
 * `optionalText`, with no maximum, so nothing here can produce a suggestion that fails on save. The
 * bound this respects is the *field* — a two-row textarea, clamped to one line on the item card.
 */
export const MAX_DESCRIPTION_LENGTH = 500;

/**
 * How much room the model gets, reasoning included.
 *
 * The plan asks for a per-feature output bound, and this is not the ~80 tokens the prose itself
 * needs. `gpt-5-nano` is a reasoning model and its reasoning tokens are billed against
 * `max_output_tokens` before a single visible character is written — a bound set to the size of the
 * answer therefore buys an `incomplete` response with an empty `output_text` every time, which is
 * the failure mode the strict-schema attempt in `docs/ai-integration-plan.md` §2 already ran into.
 * So: high enough that reasoning cannot exhaust it, far below the model's 128K ceiling, and the
 * length of the prose is held by the prompt and by `parseSuggestedDescription` instead.
 */
export const DESCRIPTION_MAX_OUTPUT_TOKENS = 2000;

/** What the model is told it is doing. Constant, so it is not rebuilt per call. */
export const DESCRIPTION_INSTRUCTIONS = [
    "You are a developer tool assistant that writes short descriptions for saved developer content.",
    "Write one or two sentences saying what the item is and what it is for, in plain English.",
    "Write about the item, not to the reader: no greeting, no 'this item', no restating the title verbatim.",
    "Describe only what is present. Do not guess at a framework, a version, or a purpose the content does not show.",
    'Respond only with JSON in the form {"description": "..."}.',
].join(" ");

/**
 * The user half of the request.
 *
 * Every part is labelled rather than concatenated, so the model can tell a name from the thing it
 * names, and a URL from a body — an untitled item then reads as a body with no name, instead of a
 * body whose first line looks like one.
 *
 * **Whatever is available, per type**, which is the requirement this feature was asked for: a
 * snippet has a body and a language, a link has a URL and often nothing else, a file or an image
 * has a title and a filename. All of them go in when present and none of them is required, so the
 * same builder serves every item type without a branch per type. The tags are included as the one
 * piece of context the content cannot carry — they are what the *user* already said the item is
 * about — and the type for the reason tagging includes it: the same shell line is a `command` or a
 * `snippet` depending only on where it was stashed.
 *
 * The closing line is not a stylistic repeat of the instructions — it is a hard requirement of the
 * API. `text.format: { type: "json_object" }` is rejected with a 400 unless the word "json" appears
 * in the **input**, and the identical word in `instructions` does not satisfy it:
 *
 *     400 Response input messages must contain the word 'json' in some form to use
 *         'text.format' of type 'json_object'.
 *
 * So every request must carry it here, whatever else the prompt says. The test asserts it for that
 * reason: the failure is a 400 on every call, not a worse answer.
 */
export function buildDescriptionInput(draft: ItemDraft): string {
    const parts = [`Item type: ${draft.type ?? "item"}`];

    if (draft.title) parts.push(`Title: ${draft.title}`);
    if (draft.language) parts.push(`Language: ${draft.language}`);
    if (draft.url) parts.push(`URL: ${draft.url}`);
    if (draft.fileName) parts.push(`File name: ${draft.fileName}`);
    if (draft.tags) parts.push(`Tags: ${draft.tags}`);

    if (draft.content) {
        parts.push(`Content:\n${truncateForModel(draft.content, AI_DESCRIPTION_CONTENT_LIMIT)}`);
    }

    parts.push("Return the description as JSON.");

    return parts.join("\n\n");
}

/** Whether there is anything worth describing, so an empty draft never reaches the model. */
export function hasDescribableContent(draft: ItemDraft): boolean {
    return Boolean(
        draft.title?.trim() || draft.content?.trim() || draft.url?.trim() || draft.fileName?.trim(),
    );
}

/**
 * Reads the description out of whatever the model returned.
 *
 * Two accepted shapes, as in `parseSuggestedTags`, because this model uses both: the wrapped object
 * the prompt asks for, and — often enough to matter — the bare string on its own. Neither is worth
 * failing over when the other is understood.
 *
 * Newlines are collapsed rather than preserved. The destination is a two-row textarea and a
 * one-line clamp on the item card, so a paragraph break is not a thing this field can show; kept,
 * it would only be invisible whitespace the user has to delete by hand.
 *
 * Anything unusable comes back as `null` rather than throwing, and the caller has one message for
 * all of it. It does not read differently depending on whether the JSON was malformed, the string
 * was empty, or the model wrote an essay.
 */
export function parseSuggestedDescription(raw: string): string | null {
    const value = stringIn(raw);

    if (value === null) return null;

    const description = value.replace(/\s+/g, " ").trim();

    if (description === "" || description.length > MAX_DESCRIPTION_LENGTH) return null;

    return description;
}

/** The string inside the response, whichever of the two shapes it arrived in. */
function stringIn(raw: string): string | null {
    let parsed: unknown;

    try {
        parsed = JSON.parse(raw);
    } catch {
        // Not JSON at all. A model that answered in plain prose still answered and the text is
        // right there, so prose is the last shape tried rather than a third failure — but only if
        // it is prose. A body that *starts* like JSON and fails to parse is a broken object, not a
        // sentence, and handing it back would put a stray `{"description": "` in the user's field.
        return /^\s*[{[]/.test(raw) ? null : raw;
    }

    if (typeof parsed === "string") return parsed;

    if (typeof parsed === "object" && parsed !== null) {
        const { description } = parsed as { description?: unknown };

        if (typeof description === "string") return description;
    }

    return null;
}
