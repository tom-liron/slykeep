import { FILE_CONSTRAINTS, extensionOf } from "./file-constraints";

/**
 * How a file item's object is shown in the drawer, and whether `GET /api/files/[id]` may serve it
 * inline.
 *
 * Nine of the ten allowed file formats are text, and the app already renders text two ways — monaco
 * for code, the markdown editor for prose — so a stashed `docker-compose.yml` is read in place
 * rather than downloaded, which is the difference between a file store and a knowledge hub. The
 * drawer calls {@link filePreviewFor} to pick a renderer; the file route calls
 * {@link isInlineDisposition} to choose a `Content-Disposition`. Only PDF needs the browser; only
 * images and PDF are not text.
 */

/**
 * Above this size, a text file is offered as a download instead of rendered.
 *
 * Monaco tokenizes on the main thread, so a multi-megabyte file would freeze the drawer. Far below
 * the 10 MB upload ceiling: the cap is about what is readable in a side panel, not what is
 * storable.
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
 * The monaco language for each textual extension. `.toml` maps to `ini` because monaco ships no
 * TOML grammar and the two agree on comments and `key = value`. `.svg` is treated as code here, not
 * as an image — see {@link isInlineDisposition}.
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
 * The image extensions safe to put in an `<img>`: every uploadable image type except `.svg`.
 *
 * Derived from the upload allow-list rather than restated, so a format added to `FILE_CONSTRAINTS`
 * is covered here without a second list to remember. `.svg` is excluded for the reason
 * {@link isInlineDisposition} gives.
 */
const IMAGE_EXTENSIONS: readonly string[] = FILE_CONSTRAINTS.image.extensions.filter(
    (extension) => extension !== ".svg",
);

/**
 * Whether this object may be put in an `<img>`.
 *
 * A name-only check rather than `filePreviewFor(...).kind === "image"`, because that answer also
 * depends on file *size* and a thumbnail must not disappear because a picture grew.
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

    // Everything below is text, which has to be fetched and parsed to be shown, so the size cap
    // applies to all of it and to nothing above it. A 40 MB PDF is the browser's problem; a 40 MB
    // JSON would be ours.
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
 * The extensions this origin may serve inline. Anything absent is served as an attachment.
 *
 * @remarks
 * An explicit allow-list, so a format added to `file-constraints.ts` is a download until a line is
 * added here. `.svg` and `.xml` are absent, and this is keyed on the filename rather than the media
 * type: both are documents that can carry script — an SVG directly, an XML through an
 * `<?xml-stylesheet?>` XSLT that emits HTML — and serving one inline renders it on this origin as
 * the signed-in user. `X-Content-Type-Options: nosniff` does not help, because the declared type is
 * already the dangerous one. Both stay previewable as their own source in the code viewer.
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
 * Independent of {@link TEXT_PREVIEW_MAX_BYTES}: this decides what happens when the URL is opened
 * directly, where a large file is the browser's business rather than the drawer's.
 */
export function isInlineDisposition(fileName: string): boolean {
    return INLINE_EXTENSIONS.has(extensionOf(fileName));
}
