import { describe, expect, it } from "vitest";

import { truncateForModel } from "./ai-text";

/**
 * The one case that matters, and the reason this function exists rather than a `slice` at each call
 * site: the obvious implementation passes every test written with ASCII and corrupts the one
 * character that does not fit in a single UTF-16 code unit.
 */

/** Small enough to build the surrogate-pair case from, and nothing else depends on the value. */
const LIMIT = 8;

describe("truncateForModel", () => {
    it("leaves content under the cap exactly as it was", () => {
        const content = "const a";

        expect(truncateForModel(content, LIMIT)).toBe(content);
    });

    it("cuts content over the cap down to it", () => {
        expect(truncateForModel("a".repeat(LIMIT + 500), LIMIT)).toHaveLength(LIMIT);
    });

    it("cuts on a character boundary, not half way through a surrogate pair", () => {
        // Each emoji is two UTF-16 code units, so the cap lands mid-character — the case a plain
        // `slice` turns into a replacement glyph.
        const cut = truncateForModel("😀".repeat(LIMIT), LIMIT);

        expect(cut).not.toContain("�");
        expect(cut.endsWith("😀")).toBe(true);
        expect([...cut]).toHaveLength(LIMIT);
    });
});
