import { describe, expect, it } from "vitest";

import { resolveIconName } from "./TypeIcon";

describe("resolveIconName", () => {
    it("falls back to File for an unknown runtime icon name", () => {
        expect(resolveIconName("NotARealIcon")).toBe("File");
    });
});
