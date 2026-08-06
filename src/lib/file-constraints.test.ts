import { describe, expect, it } from "vitest";

import {
    acceptAttribute,
    extensionOf,
    isFileItemTypeName,
    validateUpload,
} from "./file-constraints";

/** A file as the browser describes one, so each case can vary a single property. */
const png = { name: "diagram.png", size: 1024, type: "image/png" };

describe("validateUpload", () => {
    describe("size", () => {
        it("accepts a file inside its type's limit", () => {
            expect(validateUpload(png, "image")).toEqual({ valid: true, contentType: "image/png" });
        });

        it("rejects an image over 5 MB", () => {
            const result = validateUpload({ ...png, size: 5 * 1024 * 1024 + 1 }, "image");

            expect(result).toEqual({ valid: false, error: "Files must be 5 MB or smaller." });
        });

        it("allows a file up to 10 MB, where an image would already be refused", () => {
            const pdf = { name: "spec.pdf", size: 8 * 1024 * 1024, type: "application/pdf" };

            expect(validateUpload(pdf, "file").valid).toBe(true);
        });

        it("rejects an empty file", () => {
            // Nothing downstream breaks on a zero-byte object, but it is never what was meant, and
            // it is what a failed drag-and-drop of a folder produces.
            expect(validateUpload({ ...png, size: 0 }, "image").valid).toBe(false);
        });
    });

    describe("extension", () => {
        it("rejects an extension the type does not allow", () => {
            const result = validateUpload({ ...png, name: "run.sh", type: "" }, "file");

            expect(result.valid).toBe(false);
        });

        it("rejects an image extension on a file item, and the reverse", () => {
            // The two types have disjoint lists, which is what keeps `/items/images` from filling up
            // with PDFs.
            expect(validateUpload(png, "file").valid).toBe(false);
            expect(
                validateUpload({ name: "a.pdf", size: 10, type: "application/pdf" }, "image").valid,
            ).toBe(false);
        });

        it("ignores the case of the extension", () => {
            expect(validateUpload({ ...png, name: "DIAGRAM.PNG" }, "image").valid).toBe(true);
        });

        it("rejects a name with no extension at all", () => {
            expect(validateUpload({ ...png, name: "diagram", type: "" }, "image").valid).toBe(
                false,
            );
        });
    });

    describe("media type", () => {
        it("rejects a type outside the allowlist even when the extension passes", () => {
            const result = validateUpload({ ...png, type: "application/x-msdownload" }, "image");

            expect(result).toEqual({
                valid: false,
                error: "That file's type (application/x-msdownload) is not allowed.",
            });
        });

        it("accepts an empty type, which is what the platform reports for .md and .toml", () => {
            // The extension is the half the browser cannot get wrong, so an unknown media type is
            // not evidence of anything — refusing it would refuse ordinary markdown uploads.
            const result = validateUpload({ name: "notes.md", size: 10, type: "" }, "file");

            expect(result).toEqual({ valid: true, contentType: "text/markdown" });
        });

        it("ignores parameters and case on the declared type", () => {
            const result = validateUpload(
                { name: "a.csv", size: 10, type: "TEXT/CSV; charset=utf-8" },
                "file",
            );

            expect(result.valid).toBe(true);
        });

        it("stores the extension's canonical type rather than what the client claimed", () => {
            // `text/plain` is a legitimate thing for a browser to report for YAML, and storing it
            // would make the object download as a .txt later.
            const result = validateUpload(
                { name: "compose.yml", size: 10, type: "text/plain" },
                "file",
            );

            expect(result).toEqual({ valid: true, contentType: "application/x-yaml" });
        });
    });
});

describe("extensionOf", () => {
    it("takes the last extension, lowercased", () => {
        expect(extensionOf("archive.TAR.GZ")).toBe(".gz");
    });

    it("is empty for a name with no extension", () => {
        expect(extensionOf("Makefile")).toBe("");
    });

    it("does not read a dot from a directory name", () => {
        // Not reachable from a file input, but `name` is a string from the client either way.
        expect(extensionOf("some.dir/Makefile")).toBe("");
    });
});

describe("acceptAttribute", () => {
    it("lists the type's extensions for the file input", () => {
        expect(acceptAttribute("image")).toBe(".png,.jpg,.jpeg,.gif,.webp,.svg");
    });
});

describe("isFileItemTypeName", () => {
    it("is true for exactly the two FILE types", () => {
        expect(isFileItemTypeName("file")).toBe(true);
        expect(isFileItemTypeName("image")).toBe(true);
        expect(isFileItemTypeName("snippet")).toBe(false);
    });
});
