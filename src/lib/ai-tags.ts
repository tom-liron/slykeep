import { truncateForModel } from "@/lib/ai-text";
import { TAG_MAX_LENGTH } from "@/lib/item-schemas";

/**
 * Prompt building and response parsing for the auto-tagging model call.
 *
 * `actions/ai.ts` calls {@link buildTagInput} for the request and {@link parseSuggestedTags} for
 * what comes back; `addTagToInput` folds an accepted suggestion into the form's tag field. Pure
 * functions in `lib/` rather than beside the action: a `"use server"` module may only export async
 * functions, and these are the halves a unit test needs to reach without a network — a prompt
 * missing the word the API requires, a response arriving in either of the two shapes this model
 * uses. No `server-only` here — there is no secret in this file, and staying client-reachable is
 * what lets {@link TAG_MAX_LENGTH} be shared with the form.
 */

/**
 * How much of an item's body the model is shown.
 *
 * A cap because input is billed by the token and a stashed file can be long, while a snippet's tags
 * are decided by its first paragraph in practice. Head-biased: the top of a snippet is its imports
 * and signature.
 */
export const AI_TAG_CONTENT_LIMIT = 2000;

/**
 * How many suggestions are kept. The prompt asks for three to five; this is what holds the model to
 * it, since nothing about the request guarantees the count comes back in range.
 */
export const MAX_SUGGESTED_TAGS = 5;

/** What the model is told it is doing. Constant, so it is not rebuilt per call. */
export const TAG_INSTRUCTIONS = [
    "You are a developer tool assistant that labels saved developer content.",
    "Suggest 3 to 5 short, lowercase tags describing the technologies, concepts, and purpose of the item.",
    "Prefer widely used terms a developer would search for, such as react, testing, or docker.",
    "Each tag is one or two words. Do not repeat the item's title verbatim, and do not invent details that are not present.",
    'Respond only with JSON in the form {"tags": ["tag-one", "tag-two"]}.',
].join(" ");

/**
 * Builds the user half of the request.
 *
 * The title, body and type are labelled rather than concatenated, so the model can tell a name from
 * the thing it names and an untitled item reads as a body with no name. The type is signal the
 * content does not carry: the same shell line is a `command` or a `snippet` depending on where it
 * was stashed.
 *
 * @remarks
 * The closing "Return the tags as JSON." line is required by the API, not stylistic:
 * `text.format: { type: "json_object" }` is rejected with a 400 unless the word "json" appears in
 * the input, and the same word in `instructions` does not satisfy it. `ai-tags.test.ts` asserts the
 * line is present.
 */
export function buildTagInput({
    title,
    content,
    type,
}: {
    title: string;
    content: string;
    type?: string;
}): string {
    const parts = [`Item type: ${type ?? "item"}`];

    if (title) parts.push(`Title: ${title}`);
    if (content) parts.push(`Content:\n${truncateForModel(content, AI_TAG_CONTENT_LIMIT)}`);

    parts.push("Return the tags as JSON.");

    return parts.join("\n\n");
}

/**
 * Reads the tag list out of whatever the model returned, normalized as the tag field normalizes on
 * save.
 *
 * @remarks
 * Two accepted shapes, because this model uses both: `{"tags": [...]}` and a bare `[...]`. The
 * entries are then trimmed, lowercased, and de-duplicated exactly as the save path does, so the
 * badges show what will be stored. An over-length tag is dropped rather than cut — `item-schemas`
 * rejects a whole payload over {@link TAG_MAX_LENGTH}, so a truncated suggestion would fail on save.
 * Anything unparseable returns `[]`, which the caller reports with its one "nothing usable" message.
 */
export function parseSuggestedTags(raw: string): string[] {
    const seen = new Set<string>();

    return listOf(raw).reduce<string[]>((tags, entry) => {
        if (tags.length >= MAX_SUGGESTED_TAGS || typeof entry !== "string") return tags;

        const tag = entry.trim().toLowerCase();

        if (tag === "" || tag.length > TAG_MAX_LENGTH || seen.has(tag)) return tags;

        seen.add(tag);
        tags.push(tag);

        return tags;
    }, []);
}

/** The array inside the response, whichever of the two shapes it arrived in. */
function listOf(raw: string): unknown[] {
    let parsed: unknown;

    try {
        parsed = JSON.parse(raw);
    } catch {
        return [];
    }

    if (Array.isArray(parsed)) return parsed;

    if (typeof parsed === "object" && parsed !== null) {
        const { tags } = parsed as { tags?: unknown };

        if (Array.isArray(tags)) return tags;
    }

    return [];
}

/**
 * Adds an accepted suggestion to the comma-separated tag input.
 *
 * @remarks
 * The field holds one string the schema splits on save, so this is a string edit. A tag already in
 * the field is not added again, compared case-insensitively because the schema de-duplicates that
 * way. A trailing separator left mid-typing (`react,` or `react, `) is replaced rather than
 * appended to, so the result is never `react, , hooks`.
 */
export function addTagToInput(value: string, tag: string): string {
    const existing = value.split(",").map((entry) => entry.trim().toLowerCase());

    if (existing.includes(tag.trim().toLowerCase())) return value;

    const base = value.trim().replace(/,+$/, "").trim();

    return base === "" ? tag : `${base}, ${tag}`;
}
