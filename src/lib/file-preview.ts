import { FILE_CONSTRAINTS, extensionOf } from "./file-constraints";

/**
 * How a file item's object is shown in the drawer, and whether the file route may serve it inline.
 *
 * Nine of the ten allowed file formats are text, and this app already renders text two ways — monaco
 * for code, the markdown editor for prose. So a stashed `docker-compose.yml` is read in place rather
 * than downloaded and opened somewhere else, which is the difference between a file store and a
 * knowledge hub. Only PDF needs the browser, and only images and PDFs are not text at all.
 */

/**
 * Above this, a text file is offered as a download instead of rendered.
 *
 * Monaco tokenizes on the main thread, so a multi-megabyte YAML would freeze the drawer it was
 * opened in — and nobody reads one in a side panel anyway. Well under the 10 MB upload ceiling on
 * purpose: the cap is about what is *readable*, not what is storable.
 */
export const TEXT_PREVIEW_MAX_BYTES = 512 * 1024;

export type FilePreviewKind =
    /** Rendered by `<img>`. */
    | "image"
    /** Rendered by `MarkdownEditor`, as a note is. */
    | "markdown"
    /** Rendered by `CodeEditor`, highlighted as `language`. */
    | "code"
    /** Handed to the browser's own viewer in an iframe. */
    | "pdf"
    /** Name and size only — too large to render, or nothing here can render it. */
    | "none";

/**
 * The monaco language for each textual extension. `.toml` maps to `ini` because monaco ships no TOML
 * grammar and the two agree on comments and `key = value`, which is most of a TOML file. `.svg` is
 * here rather than with the images deliberately — see `isInlineDisposition`.
 */
const CODE_LANGUAGE_BY_EXTENSION: Record<string, string> = {
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".xml": "xml",
    ".svg": "xml",
    ".toml": "ini",
    ".ini": "ini",
    ".csv": "plaintext",
    ".txt": "plaintext",
};

/**
 * Derived from the upload allow-list rather than restated, minus the one extension that is allowed
 * as an image upload and must never be rendered as one. A hand-written copy is a second list that
 * has to be remembered whenever `FILE_CONSTRAINTS` gains a format — and the failure is silent: a
 * newly permitted `.avif` would upload, store, and then render as a name-and-size card.
 */
const IMAGE_EXTENSIONS: readonly string[] = FILE_CONSTRAINTS.image.extensions.filter(
    (extension) => extension !== ".svg",
);

/**
 * Whether this object may be put in an `<img>`.
 *
 * Every uploadable image extension except `.svg`, which the gallery and the drawer both have to
 * exclude for the reason `isInlineDisposition` gives — and which is why this is a name-only check
 * rather than `filePreviewFor(...).kind === "image"`. That answer also depends on the file's *size*,
 * and a thumbnail must not disappear because a picture grew.
 */
export function isRenderableImage(fileName: string): boolean {
    return IMAGE_EXTENSIONS.includes(extensionOf(fileName));
}

export type FilePreview = { kind: FilePreviewKind; language: string };

/** What the drawer should render for this object. */
export function filePreviewFor(file: { name: string; size: number }): FilePreview {
    const extension = extensionOf(file.name);

    if (extension === ".pdf") {
        return { kind: "pdf", language: "" };
    }

    if (isRenderableImage(file.name)) {
        return { kind: "image", language: "" };
    }

    // Everything below this line is text, and text has to be fetched and parsed to be shown — so the
    // size cap applies to all of it and to nothing above it. A 40 MB PDF is the browser's problem;
    // a 40 MB JSON would be ours.
    if (file.size > TEXT_PREVIEW_MAX_BYTES) {
        return { kind: "none", language: "" };
    }

    if (extension === ".md") {
        return { kind: "markdown", language: "" };
    }

    const language = CODE_LANGUAGE_BY_EXTENSION[extension];

    return language ? { kind: "code", language } : { kind: "none", language: "" };
}

/**
 * The extensions this origin may render. Anything absent is served as an attachment.
 *
 * An allow-list rather than the list of everything previewable minus its exceptions, which is what
 * this was and is how `.xml` got in: it was never named, it arrived through
 * `CODE_LANGUAGE_BY_EXTENSION`, and the `.svg` exception sitting right beside it did not cover it.
 * Stated this way, a format added to `file-constraints.ts` is a download until somebody decides
 * otherwise here, and the decision is one line in one place.
 *
 * `.svg` and `.xml` are the two deliberately absent, and the reason this is keyed on the filename
 * rather than the media type. Both are documents that can carry script — an SVG directly, an XML
 * through an `<?xml-stylesheet?>` XSLT that emits HTML — and serving one inline means a request to
 * our own origin renders it there, as the signed-in user. `X-Content-Type-Options: nosniff` is no
 * help: it stops a browser guessing a *different* type, and the declared type is already the
 * dangerous one. Both stay previewable — as their own source, in the code viewer, which is the more
 * useful thing to see anyway.
 */
const INLINE_EXTENSIONS = new Set([
    ".pdf",
    ...IMAGE_EXTENSIONS,
    ".md",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".csv",
    ".txt",
]);

/**
 * Whether `GET /api/files/[id]` may answer with `Content-Disposition: inline`.
 *
 * Independent of the size cap above: this decides what happens when the URL is opened directly,
 * where a large file is the browser's business rather than the drawer's.
 */
export function isInlineDisposition(fileName: string): boolean {
    return INLINE_EXTENSIONS.has(extensionOf(fileName));
}
