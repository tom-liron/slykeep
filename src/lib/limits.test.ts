import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Loads `limits.ts` with `ENFORCE_PRO_LIMITS` forced either way.
 *
 * The flag is a module-level constant read at call time, so the rules cannot be exercised in both
 * states without re-importing the module behind a mocked `config/access`. Testing the *behaviour*
 * of the switch rather than its current value is also what keeps these tests meaningful past
 * launch, when the real flag flips to `true`.
 */
async function loadLimits(enforce: boolean) {
    vi.resetModules();
    vi.doMock("@/config/access", () => ({ ENFORCE_PRO_LIMITS: enforce }));

    return import("./limits");
}

afterEach(() => {
    vi.doUnmock("@/config/access");
    vi.resetModules();
});

describe("with entitlement enforcement disabled", () => {
    it("allows everything, whatever the plan or the count", async () => {
        const { canAccessItemType, canCreateItem, canCreateCollection, canUseAi } =
            await loadLimits(false);

        expect(canAccessItemType(false, true)).toBe(true);
        expect(canUseAi(false)).toBe(true);
        expect(canCreateItem(false, 50)).toBe(true);
        expect(canCreateItem(false, 5_000)).toBe(true);
        expect(canCreateCollection(false, 3)).toBe(true);
        expect(canCreateCollection(false, 5_000)).toBe(true);
    });
});

describe("canAccessItemType", () => {
    it("gates Pro types on the plan once enforcement is on", async () => {
        const { canAccessItemType } = await loadLimits(true);

        expect(canAccessItemType(false, true)).toBe(false);
        expect(canAccessItemType(true, true)).toBe(true);
        expect(canAccessItemType(false, false)).toBe(true);
    });
});

describe("canCreateItem", () => {
    it("allows a free account up to the limit and refuses the one past it", async () => {
        const { canCreateItem, FREE_ITEM_LIMIT } = await loadLimits(true);

        expect(FREE_ITEM_LIMIT).toBe(50);
        expect(canCreateItem(false, 49)).toBe(true);
        // At 50 the next one would be the 51st.
        expect(canCreateItem(false, 50)).toBe(false);
        expect(canCreateItem(false, 51)).toBe(false);
    });

    it("allows an empty account", async () => {
        const { canCreateItem } = await loadLimits(true);

        expect(canCreateItem(false, 0)).toBe(true);
    });

    it("never limits Pro", async () => {
        const { canCreateItem } = await loadLimits(true);

        expect(canCreateItem(true, 50)).toBe(true);
        expect(canCreateItem(true, 5_000)).toBe(true);
    });
});

describe("canCreateCollection", () => {
    it("allows a free account up to the limit and refuses the one past it", async () => {
        const { canCreateCollection, FREE_COLLECTION_LIMIT } = await loadLimits(true);

        expect(FREE_COLLECTION_LIMIT).toBe(3);
        expect(canCreateCollection(false, 2)).toBe(true);
        expect(canCreateCollection(false, 3)).toBe(false);
        expect(canCreateCollection(false, 4)).toBe(false);
    });

    it("allows an empty account", async () => {
        const { canCreateCollection } = await loadLimits(true);

        expect(canCreateCollection(false, 0)).toBe(true);
    });

    it("never limits Pro", async () => {
        const { canCreateCollection } = await loadLimits(true);

        expect(canCreateCollection(true, 3)).toBe(true);
        expect(canCreateCollection(true, 5_000)).toBe(true);
    });
});

describe("canUseAi", () => {
    it("refuses a free account and allows Pro", async () => {
        const { canUseAi } = await loadLimits(true);

        expect(canUseAi(false)).toBe(false);
        expect(canUseAi(true)).toBe(true);
    });

    it("bypasses for everyone while enforcement is off, like every other gate", async () => {
        const { canUseAi } = await loadLimits(false);

        expect(canUseAi(false)).toBe(true);
    });
});
