import { describe, expect, it } from "vitest";

import { canAccessItemType } from "./limits";

describe("canAccessItemType", () => {
    it("keeps Pro item types available while entitlement enforcement is disabled", () => {
        expect(canAccessItemType(false, true)).toBe(true);
    });
});
