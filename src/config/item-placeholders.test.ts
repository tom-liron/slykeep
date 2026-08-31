import { describe, expect, it } from "vitest";

import { PLACEHOLDERS, TITLE_MAX_LENGTH } from "@/config/item-placeholders";

const titles = Object.entries(PLACEHOLDERS).map(([type, { title }]) => [type, title] as const);

describe("title placeholders", () => {
    // The rule this file exists for. A title longer than the field is clipped mid-word on a phone,
    // and it has been shipped that way twice — "e.g. Postgres connection pooling" and then
    // "e.g. Reset a branch to origin", each fixed on its own and neither leaving anything behind to
    // stop the next one. An eighth item type is the case this is waiting for.
    it.each(titles)("%s fits the field on a phone", (_type, title) => {
        expect(title.length).toBeLessThanOrEqual(TITLE_MAX_LENGTH);
    });

    // The other half of the documented convention: a title placeholder is an example, marked as one
    // so an empty field is never mistaken for a filled-in one.
    it.each(titles)("%s is written as an example", (_type, title) => {
        expect(title.startsWith("e.g. ")).toBe(true);
    });
});
