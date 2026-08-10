import { describe, expect, it } from "vitest";

import { buildPagination, getPageWindow, paginationSkip, parsePageParam } from "./pagination";

describe("parsePageParam", () => {
    it("reads a page number out of the query string", () => {
        expect(parsePageParam("3")).toBe(3);
    });

    it("falls back to page 1 for anything that is not a page number", () => {
        for (const value of [undefined, "", "0", "-2", "1.5", "banana"]) {
            expect(parsePageParam(value)).toBe(1);
        }
    });

    it("accepts any integer form, leaving the range to the clamp", () => {
        expect(parsePageParam("1e3")).toBe(1000);
    });

    it("takes the first value when the param is repeated", () => {
        expect(parsePageParam(["2", "5"])).toBe(2);
    });
});

describe("buildPagination", () => {
    it("divides the total into pages", () => {
        expect(buildPagination(50, 1, 21)).toMatchObject({
            page: 1,
            pageCount: 3,
            totalCount: 50,
            perPage: 21,
        });
    });

    it("does not add a trailing page when the total divides evenly", () => {
        expect(buildPagination(42, 1, 21).pageCount).toBe(2);
    });

    it("clamps a page past the end to the last one", () => {
        expect(buildPagination(50, 99, 21).page).toBe(3);
    });

    it("reports one page for an empty result set", () => {
        expect(buildPagination(0, 1, 21)).toMatchObject({ page: 1, pageCount: 1, totalCount: 0 });
    });
});

describe("paginationSkip", () => {
    it("skips nothing on the first page", () => {
        expect(paginationSkip(buildPagination(50, 1, 21))).toBe(0);
    });

    it("skips whole pages thereafter", () => {
        expect(paginationSkip(buildPagination(50, 3, 21))).toBe(42);
    });

    it("skips by the clamped page, never past the end of the set", () => {
        expect(paginationSkip(buildPagination(50, 99, 21))).toBe(42);
    });
});

describe("getPageWindow", () => {
    it("lists every page when they all fit", () => {
        expect(getPageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
    });

    it("elides both ends around a page in the middle", () => {
        expect(getPageWindow(6, 12)).toEqual([1, "ellipsis", 5, 6, 7, "ellipsis", 12]);
    });

    it("spells out a gap of exactly one page rather than eliding it", () => {
        expect(getPageWindow(4, 12)).toEqual([1, 2, 3, 4, 5, "ellipsis", 12]);
    });

    it("keeps the first and last page reachable from either end", () => {
        expect(getPageWindow(1, 12)).toEqual([1, 2, "ellipsis", 12]);
        expect(getPageWindow(12, 12)).toEqual([1, "ellipsis", 11, 12]);
    });

    it("returns the single page when there is only one", () => {
        expect(getPageWindow(1, 1)).toEqual([1]);
    });
});
