/**
 * The input-text handling shared by every AI feature: the payload ceiling, and the truncation the
 * prompt builders apply.
 *
 * `ai-tags.ts`, `ai-description.ts`, `ai-explain.ts` and `ai-optimize.ts` all import
 * {@link truncateForModel} to cut an item's body to a per-feature limit before it goes into a
 * prompt. {@link AI_PAYLOAD_LIMIT} is the Zod-enforced per-field ceiling at the Server Action
 * boundary, before that truncation runs. Neither belongs to one feature, so both live here.
 */

/**
 * The largest payload any of the four AI actions will accept.
 *
 * @remarks
 * A bound on the request, not a product limit: an item's content is uncapped and legitimately runs
 * past every per-feature content limit, which is why prompt builders truncate rather than refuse.
 * The Server Action enforces this ceiling before a feature-specific builder handles the payload.
 */
export const AI_PAYLOAD_LIMIT = 100_000;

/**
 * Cuts `content` to `limit` characters without splitting a character in half.
 *
 * @remarks
 * String indices are UTF-16 code units, so a plain `slice` can land between the halves of a
 * surrogate pair and leave a lone half — an emoji or CJK character turned into a replacement glyph.
 * Spreading into an array iterates by code point, so the cut lands on a real boundary. Head-biased:
 * the top of a snippet is its imports and signature, and the first paragraph of a note is what it
 * is about.
 */
export function truncateForModel(content: string, limit: number): string {
    if (content.length <= limit) return content;

    return [...content].slice(0, limit).join("");
}
