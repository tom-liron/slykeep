import { extensionOf } from "./file-constraints";

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

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

export type FilePreview = { kind: FilePreviewKind; language: string };

/** What the drawer should render for this object. */
export function filePreviewFor(file: { name: string; size: number }): FilePreview {
    const extension = extensionOf(file.name);

    if (extension === ".pdf") {
        return { kind: "pdf", language: "" };
    }

    if (IMAGE_EXTENSIONS.includes(extension)) {
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
 * Whether `GET /api/files/[id]` may answer with `Content-Disposition: inline`.
 *
 * Independent of the size cap above: this decides what happens when the URL is opened directly,
 * where a large file is the browser's business rather than the drawer's.
 *
 * SVG is the one exception, and the reason this is keyed on the filename rather than the media type.
 * An SVG is a document that can carry script, and serving one inline means a request to our own
 * origin renders it there. It is still previewable — as its own source, in the code viewer, which is
 * the more useful thing to see anyway.
 */
export function isInlineDisposition(fileName: string): boolean {
    const extension = extensionOf(fileName);

    if (extension === ".svg") {
        return false;
    }

    return (
        extension === ".pdf" ||
        IMAGE_EXTENSIONS.includes(extension) ||
        extension === ".md" ||
        extension in CODE_LANGUAGE_BY_EXTENSION
    );
}
