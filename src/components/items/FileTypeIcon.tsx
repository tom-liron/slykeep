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
 * The icon for one uploaded object, chosen by its extension.
 *
 * Keyed on the extension rather than on `filePreviewFor`, which the drawer uses: that answers "can
 * this be rendered here", and its answer depends on the file's *size* — a 2 MB YAML previews as
 * `none`. An icon must not change because a file got bigger, so the two questions stay separate.
 *
 * The mapping is by category, not by format: every extension the upload rules allow lands on one of
 * five glyphs, and the exact format is already spelled out in the filename beside it.
 */
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
    // `createElement` rather than `<Icon {...props} />`: the rule that catches components defined
    // during render cannot tell a lookup in a static table from a component built on the spot, and
    // this is a lookup — the table above is a module constant.
    return createElement(fileIconFor(fileName), props);
}
