import { formatFileSize } from "./format";

/**
 * The upload rules for the two FILE item types, and the check that enforces them.
 *
 * Shared because both sides need the same numbers: `POST /api/upload` validates against them with
 * {@link validateUpload}; `FileUpload` builds the accept attribute and type-specific size hint; and
 * `use-file-upload.ts` repeats validation for client-side feedback. `r2.ts` is `server-only`, so a
 * component cannot get the rules there. The route is the authority; client checks only spare an
 * obviously doomed round trip.
 */

/** The item types whose content is an uploaded object rather than a column. */
export const FILE_ITEM_TYPE_NAMES = ["file", "image"] as const;

export type FileItemTypeName = (typeof FILE_ITEM_TYPE_NAMES)[number];

/**
 * Takes a plain `string` rather than an `ItemTypeName`, because one caller is a route handler
 * narrowing a form field — untyped by definition — and the others pass a name that already
 * satisfies it.
 */
export function isFileItemTypeName(name: string): name is FileItemTypeName {
    return (FILE_ITEM_TYPE_NAMES as readonly string[]).includes(name);
}

/**
 * The canonical media type per extension, used when the browser cannot name one: `File.type` is
 * empty for `.md`, `.toml` and `.ini` on most platforms, and an object stored as
 * `application/octet-stream` downloads as a blob instead of opening.
 */
const EXTENSION_MIME: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".json": "application/json",
    ".yaml": "application/x-yaml",
    ".yml": "application/x-yaml",
    ".xml": "application/xml",
    ".csv": "text/csv",
    ".toml": "application/toml",
    ".ini": "text/plain",
};

/**
 * Size ceiling, permitted extensions and permitted media types, per type.
 *
 * The media-type lists are wider than {@link EXTENSION_MIME} because a browser reports whichever
 * name its platform holds — `text/yaml` and `application/x-yaml` are one file, and several of these
 * arrive as `text/plain`. The extension list is the strict half of the pair.
 */
export const FILE_CONSTRAINTS = {
    image: {
        maxSize: 5 * 1024 * 1024,
        extensions: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
        mimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"],
    },
    file: {
        maxSize: 10 * 1024 * 1024,
        extensions: [
            ".pdf",
            ".txt",
            ".md",
            ".json",
            ".yaml",
            ".yml",
            ".xml",
            ".csv",
            ".toml",
            ".ini",
        ],
        mimeTypes: [
            "application/pdf",
            "text/plain",
            "text/markdown",
            "application/json",
            "application/x-yaml",
            "text/yaml",
            "application/xml",
            "text/xml",
            "text/csv",
            "application/toml",
        ],
    },
} as const satisfies Record<
    FileItemTypeName,
    { maxSize: number; extensions: readonly string[]; mimeTypes: readonly string[] }
>;

/**
 * The largest object any type accepts, derived from {@link FILE_CONSTRAINTS} rather than restated.
 *
 * For the write boundary, which checks a *claimed* size before it knows the type, so the ceiling it
 * can apply is the highest any type allows. {@link validateUpload} still applies the exact per-type
 * limit to the bytes in hand; this only bounds what a hand-written payload may assert about an
 * object it did not upload.
 */
export const MAX_UPLOAD_BYTES = Math.max(
    ...Object.values(FILE_CONSTRAINTS).map(({ maxSize }) => maxSize),
);

/** The lowercased extension including the dot, or "" when the name has none. */
export function extensionOf(fileName: string): string {
    return fileName.match(/\.[^./\\]+$/)?.[0].toLowerCase() ?? "";
}

/** What an `<input type="file">` should offer, e.g. ".png,.jpg,…". */
export function acceptAttribute(itemType: FileItemTypeName): string {
    return FILE_CONSTRAINTS[itemType].extensions.join(",");
}

export type FileValidation = { valid: true; contentType: string } | { valid: false; error: string };

/**
 * Checks one file against its type's rules and settles what it will be stored as.
 *
 * @remarks
 * Extension first and always — it is the half the browser cannot get wrong. The media type is
 * checked only when the browser supplied one: an empty `File.type` means the platform has no
 * mapping, not that the file is suspicious, and rejecting it would refuse ordinary `.md` and
 * `.toml` uploads. The stored type comes from the extension wherever there is a canonical name for
 * it, so what is written to R2 is never simply what the client claimed.
 */
export function validateUpload(
    file: { name: string; size: number; type: string },
    itemType: FileItemTypeName,
): FileValidation {
    const { maxSize, extensions, mimeTypes } = FILE_CONSTRAINTS[itemType];

    if (file.size === 0) {
        return { valid: false, error: "That file is empty." };
    }

    if (file.size > maxSize) {
        return { valid: false, error: `Files must be ${formatFileSize(maxSize)} or smaller.` };
    }

    const extension = extensionOf(file.name);

    if (!(extensions as readonly string[]).includes(extension)) {
        return {
            valid: false,
            error: `${itemType === "image" ? "Images" : "Files"} must be one of: ${extensions.join(", ")}.`,
        };
    }

    const declared = file.type.split(";")[0].trim().toLowerCase();

    if (declared && !(mimeTypes as readonly string[]).includes(declared)) {
        return { valid: false, error: `That file's type (${declared}) is not allowed.` };
    }

    return { valid: true, contentType: EXTENSION_MIME[extension] ?? declared };
}
