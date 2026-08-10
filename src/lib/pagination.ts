import type { PaginationViewModel } from "@/types/view-models";

/**
 * Page numbers are read from the URL, so every value here arrives as untrusted text. The rule is the
 * same one the rest of the app applies to input: normalize rather than reject. A `?page=` that is
 * missing, empty, negative, fractional, or the word "banana" all mean the same thing to a reader —
 * they want the listing — so they all resolve to page 1 rather than a 404 on a link somebody shared.
 */
export function parsePageParam(value: string | string[] | undefined): number {
    // Next.js gives an array when a param is repeated (`?page=2&page=5`); the first wins.
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw) {
        return 1;
    }

    const page = Number(raw);
    return Number.isInteger(page) && page >= 1 ? page : 1;
}

/**
 * Clamps a requested page against what the result set actually has, so callers can turn it into a
 * `skip` without checking anything themselves.
 *
 * An empty result set is one page rather than zero: the listing still renders — as its empty state —
 * and "page 1 of 0" is not a thing to show anyone.
 */
export function buildPagination(
    totalCount: number,
    requestedPage: number,
    perPage: number,
): PaginationViewModel {
    const pageCount = Math.max(1, Math.ceil(totalCount / perPage));

    return {
        page: Math.min(Math.max(1, requestedPage), pageCount),
        pageCount,
        totalCount,
        perPage,
    };
}

/** How many rows to skip to reach the described page. */
export function paginationSkip(pagination: PaginationViewModel): number {
    return (pagination.page - 1) * pagination.perPage;
}

/**
 * The page numbers to render as links, with `"ellipsis"` standing in for a run that is hidden.
 *
 * Always the first page, the last page, and the current one with a neighbour either side. A gap of
 * exactly one page is spelled out instead of elided — an ellipsis hiding a single number is both
 * longer to render and harder to use than the number itself.
 */
export function getPageWindow(page: number, pageCount: number): (number | "ellipsis")[] {
    const shown = [...new Set([1, page - 1, page, page + 1, pageCount])]
        .filter((candidate) => candidate >= 1 && candidate <= pageCount)
        .sort((left, right) => left - right);

    return shown.flatMap((current, index) => {
        const previous = shown[index - 1];
        if (previous === undefined || current - previous === 1) {
            return [current];
        }
        return current - previous === 2 ? [current - 1, current] : ["ellipsis" as const, current];
    });
}
