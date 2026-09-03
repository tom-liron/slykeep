import { truncateForModel } from "@/lib/ai-text";
import type { ItemDraft } from "@/types/ai";

/**
 * Prompt building and response parsing for the description model call.
 *
 * `actions/ai.ts` calls {@link buildDescriptionInput} for the request and
 * {@link parseSuggestedDescription} for what comes back, guarded by {@link hasDescribableContent}.
 * Pure functions in `lib/` beside `ai-tags.ts`, for the reasons that file gives — a `"use server"`
 * module may only export async functions, and these are the halves a unit test needs without a
 * network.
 */

/**
 * How much of an item's body the model is shown.
 *
 * Input is billed by the token and a stashed file can be long, while the head of the content is
 * what says what the thing is. Equal to tagging's limit today, but stated here so a description that
 * later wants more context is a change in one place.
 */
export const AI_DESCRIPTION_CONTENT_LIMIT = 2000;

/**
 * The longest description accepted back — roughly double the two sentences the prompt asks for.
 *
 * @remarks
 * A guard against a model that ignored the instruction, not a trim: an over-length response is
 * rejected rather than cut, because half a sentence about an item says something the model did not.
 * `item-schemas.ts` puts no maximum on `description`, so nothing here can produce a suggestion that
 * fails on save; the bound this respects is the field — a two-row textarea, one line on the card.
 */
export const MAX_DESCRIPTION_LENGTH = 500;

/**
 * The `max_output_tokens` ceiling for the call, covering reasoning as well as prose.
 *
 * @remarks
 * `gpt-5-nano` is a reasoning model and bills reasoning tokens against `max_output_tokens` before
 * any visible character, so a ceiling set to the ~80 tokens of prose returns an `incomplete`
 * response with empty `output_text`. This is set high enough that reasoning cannot exhaust it and
 * far below the model's 128K ceiling; the prose length is held by the prompt and by
 * {@link parseSuggestedDescription}.
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
 * Builds the user half of the request from whatever fields the draft carries.
 *
 * Every part is labelled rather than concatenated, so the model can tell a name from the thing it
 * names and a URL from a body. Each field goes in only when present and none is required, so one
 * builder serves every item type without a per-type branch. Tags are the context the content cannot
 * carry — what the user already said the item is about — and the type distinguishes a `command`
 * from a `snippet` sharing the same shell line.
 *
 * @remarks
 * The closing "Return the description as JSON." line is required by the API, not stylistic:
 * `text.format: { type: "json_object" }` is rejected with a 400 unless the word "json" appears in
 * the input, and the same word in `instructions` does not satisfy it. The test asserts the line.
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
 * @remarks
 * Two accepted shapes, as in `parseSuggestedTags`: the wrapped object the prompt asks for, and a
 * bare string. Newlines are collapsed — the destination is a two-row textarea with a one-line clamp
 * on the card, so a paragraph break would only be whitespace the user deletes by hand. Anything
 * unusable returns `null`, which the caller reports with its one message.
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
