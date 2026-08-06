import { describe, expect, it } from "vitest";

import { FILE_CONSTRAINTS } from "./file-constraints";
import {
    filePreviewFor,
    isInlineDisposition,
    isRenderableImage,
    TEXT_PREVIEW_MAX_BYTES,
} from "./file-preview";

/** Small enough to be rendered, so each case varies only the name. */
const small = 1024;

describe("filePreviewFor", () => {
    it("renders markdown as prose, the way a note is", () => {
        expect(filePreviewFor({ name: "README.md", size: small })).toEqual({
            kind: "markdown",
            language: "",
        });
    });

    it("highlights the structured text formats in the code viewer", () => {
        const cases = [
            ["config.json", "json"],
            ["compose.yml", "yaml"],
            ["compose.yaml", "yaml"],
            ["pom.xml", "xml"],
            ["Cargo.toml", "ini"],
            ["php.ini", "ini"],
            ["rows.csv", "plaintext"],
            ["notes.txt", "plaintext"],
        ] as const;

        for (const [name, language] of cases) {
            expect(filePreviewFor({ name, size: small })).toEqual({ kind: "code", language });
        }
    });

    it("shows an SVG as its own source rather than rendering it", () => {
        // The route refuses to serve one inline, so rendering it here would be the only place it
        // could execute on this origin. Its source is the more useful view of it anyway.
        expect(filePreviewFor({ name: "logo.svg", size: small })).toEqual({
            kind: "code",
            language: "xml",
        });
    });

    it("hands a PDF to the browser's viewer", () => {
        expect(filePreviewFor({ name: "book.pdf", size: small }).kind).toBe("pdf");
    });

    it("previews the raster image formats as pictures", () => {
        for (const name of ["a.png", "a.jpg", "a.jpeg", "a.gif", "a.webp"]) {
            expect(filePreviewFor({ name, size: small }).kind).toBe("image");
        }
    });

    it("covers every extension the upload rules accept", () => {
        // The two lists are what keep a newly permitted upload from landing in the drawer with no
        // way to look at it. `.svg` previews as source, which is still a preview.
        const uploadable = [
            ...FILE_CONSTRAINTS.image.extensions,
            ...FILE_CONSTRAINTS.file.extensions,
        ];

        for (const extension of uploadable) {
            expect(filePreviewFor({ name: `file${extension}`, size: small }).kind).not.toBe("none");
        }
    });

    describe("the size cap", () => {
        it("stops rendering text past the cap, since monaco tokenizes on the main thread", () => {
            expect(
                filePreviewFor({ name: "huge.json", size: TEXT_PREVIEW_MAX_BYTES + 1 }).kind,
            ).toBe("none");
        });

        it("still renders text exactly at the cap", () => {
            expect(filePreviewFor({ name: "big.json", size: TEXT_PREVIEW_MAX_BYTES }).kind).toBe(
                "code",
            );
        });

        it("does not apply to images or PDFs, which the browser streams itself", () => {
            const size = TEXT_PREVIEW_MAX_BYTES * 10;

            expect(filePreviewFor({ name: "scan.pdf", size }).kind).toBe("pdf");
            expect(filePreviewFor({ name: "shot.png", size }).kind).toBe("image");
        });
    });

    it("has nothing to show for a format it does not know", () => {
        expect(filePreviewFor({ name: "archive.zip", size: small }).kind).toBe("none");
    });
});

describe("isRenderableImage", () => {
    it("accepts every uploadable image format except SVG", () => {
        // The gallery puts these in an `<img>`, so this list has to track the upload rules: a newly
        // permitted format that is missing here would show as an icon tile instead of a picture.
        for (const extension of FILE_CONSTRAINTS.image.extensions) {
            expect(isRenderableImage(`photo${extension}`)).toBe(extension !== ".svg");
        }
    });

    it("never renders an SVG, whatever its case", () => {
        expect(isRenderableImage("LOGO.SVG")).toBe(false);
    });

    it("agrees with the drawer, which renders exactly what this accepts", () => {
        for (const name of ["a.png", "a.svg", "a.pdf", "a.md", "archive.zip"]) {
            expect(isRenderableImage(name)).toBe(
                filePreviewFor({ name, size: small }).kind === "image",
            );
        }
    });
});

describe("isInlineDisposition", () => {
    it("serves images, PDFs, and text inline", () => {
        expect(isInlineDisposition("a.png")).toBe(true);
        expect(isInlineDisposition("a.pdf")).toBe(true);
        expect(isInlineDisposition("a.md")).toBe(true);
        expect(isInlineDisposition("a.json")).toBe(true);
    });

    it("never serves an SVG inline", () => {
        // An SVG is a document that can carry script; inline means it runs on our own origin.
        expect(isInlineDisposition("logo.svg")).toBe(false);
        expect(isInlineDisposition("LOGO.SVG")).toBe(false);
    });

    it("ignores the size cap, which is the drawer's rule and not the browser's", () => {
        expect(isInlineDisposition("huge.json")).toBe(true);
    });

    it("falls back to a download for anything else", () => {
        expect(isInlineDisposition("archive.zip")).toBe(false);
        expect(isInlineDisposition("Makefile")).toBe(false);
    });
});
