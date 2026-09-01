import { truncateForModel } from "@/lib/ai-text";
import { TAG_MAX_LENGTH } from "@/lib/item-schemas";

/**
 * The rules around the auto-tagging model call: what it is shown, and what is trusted from what it
 * says back.
 *
 * Pure functions in `lib/` rather than beside the action, for two reasons. A `"use server"` module
 * may only export async functions, so a helper exported from `actions/ai.ts` would not compile. And
 * these are the halves that can actually be *wrong* in a way the compiler cannot catch — a prompt
 * missing the one word the API requires, a response shape that arrives in the other of the two forms
 * this model uses — so they belong somewhere a unit test can reach without a network.
 *
 * No `server-only` here, unlike `openai.ts`: there is no secret in this file, and keeping it
 * client-reachable is what lets the same cap be stated once.
 */

/**
 * How much of an item's body the model is shown.
 *
 * A cap rather than the whole thing, because the input is billed by the token and a stashed file
 * can be very long — while the tags for a snippet are decided by its first paragraph in practice.
 * Head-biased for that reason: the top of a snippet is its imports and its signature, which is
 * exactly what names it.
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
 * The user half of the request.
 *
 * The title and the body are labelled rather than concatenated, so the model can tell a name from
 * the thing it names — an untitled item then reads as a body with no name, instead of a body whose
 * first line looks like one. The type is included because it is real signal the content does not
 * carry: the same shell line is a `command` or a `snippet` depending only on where it was stashed.
 *
 * The closing line is not a stylistic repeat of the instructions — it is a hard requirement of the
 * API. `text.format: { type: "json_object" }` is rejected with a 400 unless the word "json" appears
 * in the **input**, and the identical word in `instructions` does not satisfy it:
 *
 *     400 Response input messages must contain the word 'json' in some form to use
 *         'text.format' of type 'json_object'.
 *
 * So every request must carry it here, whatever else the prompt says. `ai-tags.test.ts` asserts it
 * for that reason: the failure is a 400 on every call, not a worse answer.
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
 * Reads the tag list out of whatever the model returned.
 *
 * Two accepted shapes, because this model uses both: `{"tags": [...]}` is what the prompt asks for,
 * and a bare `[...]` is what it sometimes sends instead. Neither is worth failing over when the
 * other is understood, and a suggestion list is not the place to be strict about a wrapper.
 *
 * Everything after that is the same normalization the tag input goes through on save — trimmed,
 * lowercased, blanks dropped, duplicates collapsed — done here as well so the badges show what will
 * actually be stored. Over-length tags are dropped rather than cut: `item-schemas` rejects the whole
 * payload over `TAG_MAX_LENGTH`, so accepting one would hand the user a suggestion that fails on
 * save, and half a truncated tag means something else than the tag did.
 *
 * Anything unparseable comes back as an empty array rather than throwing. The caller has one
 * failure message for "the model gave us nothing usable", and it does not read differently
 * depending on whether the JSON was malformed or merely empty.
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
 * The field holds one string that the schema splits on save, so accepting a tag is a string edit
 * rather than a list operation — and the two ways it can go wrong are both invisible from the type.
 * A tag the user already typed must not be added twice, compared case-insensitively because the
 * schema de-duplicates that way and would drop it anyway. And a value left mid-typing — `react,` or
 * `react, ` — must not become `react, , hooks`, so any trailing separator is replaced rather than
 * appended to.
 */
export function addTagToInput(value: string, tag: string): string {
    const existing = value.split(",").map((entry) => entry.trim().toLowerCase());

    if (existing.includes(tag.trim().toLowerCase())) return value;

    const base = value.trim().replace(/,+$/, "").trim();

    return base === "" ? tag : `${base}, ${tag}`;
}
