/**
 * The match-and-rank rule behind the command palette.
 *
 * `CommandPalette` sets cmdk's `shouldFilter={false}` and ranks results with this module instead;
 * `server/search.ts` supplies the prefetched item and collection summaries it scores. cmdk's own
 * filter scores one string per item, which would force a title, description, tag list and type label
 * to be flattened into a single value and lose the ability to weight a title hit above a description
 * hit. A pure function is also checkable by a unit test rather than by rendering a component.
 *
 * Scoring is tiered: how the query matched sets the band ({@link TIER}), and only ties within a band
 * are broken by how much of the text the query covered. A title starting with the query outranks a
 * long description that merely contains it.
 *
 * The loosest band — the query's characters scattered through the text rather than adjacent — is
 * guarded three ways: a field opts in with {@link SearchField.scattered}, the query must be at least
 * {@link MIN_SCATTERED_QUERY_LENGTH} characters, and the run must be tight
 * ({@link MAX_SCATTER_GAPS}). Any few letters hide in order inside almost any paragraph, so without
 * those guards it is not a filter.
 */

/** One piece of text a record can be matched on, and what a hit in it is worth. */
export interface SearchField {
    text: string;
    /** Multiplier applied to this field's score, so a title can outrank a description. */
    weight: number;
    /**
     * Whether the query's characters may be *scattered* through this field — "ustate" matching
     * "useState" — rather than contiguous.
     *
     * Off by default: over long prose the letters of a short query almost always appear in order
     * somewhere, so it barely filters. Titles and tags are short and hand-chosen, so a scattered hit
     * in one of those carries signal.
     *
     * @defaultValue `false`
     */
    scattered?: boolean;
}

/** The score bands, spaced wide enough that the coverage bonus below can never lift a hit into the next. */
const TIER = {
    exact: 500,
    prefix: 400,
    wordPrefix: 300,
    substring: 200,
    subsequence: 100,
} as const;

/** Kept under the gap between tiers, so it only ever reorders within a band. */
const MAX_COVERAGE_BONUS = 90;

/** What counts as the start of a word: `use-state` and `api.get` both break in the middle. */
const WORD_BOUNDARY = /[\s\-_/.:,;()[\]{}]/;

/**
 * How many extra characters may be interleaved through a scattered match before it stops being one.
 *
 * Two in total, not a ratio. A ratio grows the allowance with the query, but it is the short
 * queries that need holding down — "test" spanning eight characters of a sentence is the noise this
 * refuses. A query missing a letter or two from its target ("ustate" → "useState") still passes.
 */
const MAX_SCATTER_GAPS = 2;

/**
 * Below this length a scattered match is meaningless — two or three letters appear in order almost
 * everywhere. Shorter queries still match by prefix, word start or substring.
 */
const MIN_SCATTERED_QUERY_LENGTH = 4;

/**
 * The length of the tightest run of `text` that contains every character of `query` in order, or 0
 * if there is none.
 *
 * The span rather than a yes/no: it is what separates "ustate" inside "useState" from the same
 * letters spread over a paragraph, and the caller rejects the loose ones outright.
 */
function scatteredSpan(query: string, text: string): number {
    let shortest = 0;

    for (let start = 0; start <= text.length - query.length; start += 1) {
        if (text[start] !== query[0]) {
            continue;
        }

        let cursor = 1;
        let position = start + 1;
        while (position < text.length && cursor < query.length) {
            if (text[position] === query[cursor]) {
                cursor += 1;
            }
            position += 1;
        }

        if (cursor === query.length) {
            const span = position - start;
            if (shortest === 0 || span < shortest) {
                shortest = span;
            }
        }
    }

    return shortest;
}

/**
 * How well one query term matches one string. Zero means no match, which lets a caller require every
 * term of a query to hit something.
 *
 * Case-insensitive, and both sides are trimmed, so callers can pass raw input and raw stored text.
 * `scattered` opens the loosest tier, and is off unless the field asks for it.
 *
 * @defaultValue `scattered` is `false`
 */
export function fuzzyScore(query: string, text: string, scattered = false): number {
    const needle = query.trim().toLowerCase();
    const haystack = text.trim().toLowerCase();

    if (needle.length === 0 || haystack.length === 0) {
        return 0;
    }

    if (haystack === needle) {
        return TIER.exact + MAX_COVERAGE_BONUS;
    }

    const index = haystack.indexOf(needle);
    if (index >= 0) {
        const tier =
            index === 0
                ? TIER.prefix
                : WORD_BOUNDARY.test(haystack[index - 1])
                  ? TIER.wordPrefix
                  : TIER.substring;

        // How much of the text the query accounted for: "api" scores higher on "API client" than on
        // a paragraph that mentions it once.
        return tier + Math.round((MAX_COVERAGE_BONUS * needle.length) / haystack.length);
    }

    if (!scattered || needle.length < MIN_SCATTERED_QUERY_LENGTH) {
        return 0;
    }

    const span = scatteredSpan(needle, haystack);
    if (span === 0 || span > needle.length + MAX_SCATTER_GAPS) {
        return 0;
    }

    // Scored on the span rather than the whole text: a scattered hit is good for being tightly
    // packed, not for the string it was found in being short.
    return TIER.subsequence + Math.round((MAX_COVERAGE_BONUS * needle.length) / span);
}

/**
 * How well a whole record matches a query, across all the fields it can be found by.
 *
 * The query is split on whitespace and **every** term has to hit something — "react hook" must not
 * return everything about React — but they may hit different fields, so a term matching the title
 * and another matching a tag is a match. Each term takes its best field, and the record's score is
 * the mean, which keeps a two-term query on the same scale as a one-term one.
 */
export function scoreRecord(query: string, fields: readonly SearchField[]): number {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
        return 0;
    }

    let total = 0;
    for (const term of terms) {
        let best = 0;
        for (const field of fields) {
            best = Math.max(best, fuzzyScore(term, field.text, field.scattered) * field.weight);
        }
        if (best === 0) {
            return 0;
        }
        total += best;
    }

    return total / terms.length;
}

/**
 * The matching records, best first, capped at `limit`.
 *
 * Equal scores keep the order they arrived in — the server hands both lists over
 * most-recently-updated first, so a tie between two equally good matches is settled by recency
 * without this having to know that is what it is doing.
 */
export function rankBySearch<T>(
    query: string,
    records: readonly T[],
    toFields: (record: T) => SearchField[],
    limit: number,
): T[] {
    return records
        .map((record, position) => ({
            record,
            position,
            score: scoreRecord(query, toFields(record)),
        }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score || left.position - right.position)
        .slice(0, limit)
        .map((entry) => entry.record);
}
