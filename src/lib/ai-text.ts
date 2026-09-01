/**
 * The text handling both model calls need, in the one place neither of them owns.
 *
 * It started inside `ai-tags.ts` as `truncateForTagging`, which was right while tagging was the
 * only AI feature and stopped being right the moment a second one needed the same cut — a
 * description module importing a function with "tagging" in its name would be describing the
 * dependency wrongly, and a second `slice` written beside it would be the bug this function exists
 * to prevent, copied.
 */

/**
 * The largest payload any of the four AI actions will consider.
 *
 * **Not a product limit.** An item's content is not capped anywhere and legitimately runs past every
 * per-feature content limit, which is why the prompt builders truncate rather than refuse. This is a
 * bound on what a hand-made request can make the server hold in memory before that truncation gets
 * to run.
 *
 * One number, in the module that owns `truncateForModel`. It was four — `AI_TAG_PAYLOAD_LIMIT`,
 * `AI_DESCRIPTION_PAYLOAD_LIMIT`, `AI_EXPLAIN_PAYLOAD_LIMIT`, `AI_OPTIMIZE_PAYLOAD_LIMIT` — all
 * `100_000`, and the single consumer took `Math.min` of the set. So the per-feature names promised a
 * tuning that could not happen: raising one of them alone changed nothing at all, silently, because
 * the minimum still came from the other three.
 */
export const AI_PAYLOAD_LIMIT = 100_000;

/**
 * Cuts `content` to `limit` characters without splitting a character in half.
 *
 * JavaScript string indices are UTF-16 code units, so a plain `slice` can land between the two
 * halves of a surrogate pair and produce a lone half — an emoji or a CJK character turned into a
 * replacement glyph in the middle of what the model reads. Spreading into an array iterates by code
 * point, which is what makes the cut land on a real boundary.
 *
 * Head-biased, deliberately: the top of a snippet is its imports and its signature, which is what
 * names it, and the first paragraph of a note is what the note is about.
 */
export function truncateForModel(content: string, limit: number): string {
    if (content.length <= limit) return content;

    return [...content].slice(0, limit).join("");
}
