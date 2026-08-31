import { describe, expect, it } from "vitest";

import { invalidFor, invalidProps } from "./Field";

/**
 * These two are the half of the `${id}-error` contract that lives on the *input*; `Field` renders
 * the other half on the `<p>`. The failure mode when they disagree is silent — the field still
 * renders, the message still shows, and only a screen reader notices the two are no longer
 * connected — so it is worth pinning even though neither function has much logic in it.
 */
describe("invalidProps", () => {
    it("omits the attributes entirely when there is no error", () => {
        // `undefined`, not `{ "aria-invalid": false }`: spread into JSX, this leaves the attribute
        // off the DOM, which is what a valid field should look like to assistive technology.
        expect(invalidProps("new-item-title")).toBeUndefined();
        expect(invalidProps("new-item-title", "")).toBeUndefined();
    });

    it("points aria-describedby at the id Field renders for the same input", () => {
        expect(invalidProps("new-item-title", "Give it a title.")).toEqual({
            "aria-invalid": true,
            "aria-describedby": "new-item-title-error",
        });
    });
});

describe("invalidFor", () => {
    it("composes the prefix and the field name in that order", () => {
        // The case that would catch a renamed prefix: the four forms that call this used to build
        // this string themselves, and nothing checked it still matched the `<Field>`'s own id.
        const invalid = invalidFor<"name" | "description">("new-collection", {
            name: "That name is taken.",
        });

        expect(invalid("name")).toEqual({
            "aria-invalid": true,
            "aria-describedby": "new-collection-name-error",
        });
    });

    it("returns undefined for a field the error map does not name", () => {
        const invalid = invalidFor<"name" | "description">("edit-collection", {
            name: "That name is taken.",
        });

        expect(invalid("description")).toBeUndefined();
    });
});
