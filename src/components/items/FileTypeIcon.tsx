import {
    File,
    FileCode,
    FileImage,
    FileSpreadsheet,
    FileText,
    type LucideIcon,
    type LucideProps,
} from "lucide-react";
import { createElement } from "react";

import { extensionOf } from "@/lib/file-constraints";

/**
 * Picks the lucide icon for an uploaded object from its filename extension.
 *
 * Used by `FileRow` and `ImageCard` to label a file that is not being previewed. {@link fileIconFor}
 * is the lookup; {@link FileTypeIcon} renders the result.
 *
 * @remarks
 * Keyed on the extension alone. `filePreviewFor` in `lib/file-preview.ts` answers a different
 * question — whether a file can be *rendered* here — and its answer depends on the file's size, so
 * the two are kept separate: an icon must not change because a file got bigger.
 *
 * Every allowed extension maps to one of five category glyphs; the exact format is already in the
 * filename shown beside the icon.
 */

/** Extension (lowercased, with the dot) to lucide icon. Anything unlisted falls back in
 * {@link fileIconFor}. */
const ICON_BY_EXTENSION: Record<string, LucideIcon> = {
    ".png": FileImage,
    ".jpg": FileImage,
    ".jpeg": FileImage,
    ".gif": FileImage,
    ".webp": FileImage,
    ".svg": FileImage,
    ".csv": FileSpreadsheet,
    ".json": FileCode,
    ".xml": FileCode,
    ".yaml": FileCode,
    ".yml": FileCode,
    ".toml": FileCode,
    ".ini": FileCode,
    ".pdf": FileText,
    ".md": FileText,
    ".txt": FileText,
};

/** The icon component for a filename. Falls back to a blank file for anything unmapped. */
export function fileIconFor(fileName: string): LucideIcon {
    return ICON_BY_EXTENSION[extensionOf(fileName)] ?? File;
}

export function FileTypeIcon({ fileName, ...props }: { fileName: string } & LucideProps) {
    // `createElement` rather than `<Icon {...props} />`: the lint rule against components defined
    // during render cannot tell a lookup in the module-constant table above from a component built
    // on the spot.
    return createElement(fileIconFor(fileName), props);
}
