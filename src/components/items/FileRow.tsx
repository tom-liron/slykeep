import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FavoriteBadge, PinnedBadge } from "@/components/ui/StatusBadges";
import { formatDate, formatFileSize } from "@/lib/format";
import { softAccent, withAlpha } from "@/lib/utils";
import type { ItemSummaryViewModel } from "@/types/view-models";
import { FileTypeIcon } from "./FileTypeIcon";

/**
 * One uploaded object as a list row — the file-manager reading of an item, chosen by `ItemList` for
 * the `file` type. What matters about a file is what it is, how big it is, and when it arrived, and
 * those line up down a column across rows.
 *
 * The item's *title* is the heading; the object's filename is metadata beside the size and date,
 * the way a drive shows a file that has been renamed. An uploaded name is whatever the browser
 * handed over, so the title — the name a person chose — is the heading, and the filename shows only
 * when the two differ.
 *
 * @remarks
 * `ItemList` lays a full-row button over each entry to open the drawer. The Download anchor is
 * `relative z-10` so it sits above that overlay and takes the click first. The two are overlapping
 * siblings, not nested, so there is no event to stop propagating.
 */
export function FileRow({ item }: { item: ItemSummaryViewModel }) {
    const accent = item.itemType.color;

    // The object's name: what the icon is chosen from and what a download is saved as, not the
    // row's heading. `fileName` is almost always set; the title is the fallback for a row without
    // one.
    const fileName = item.fileName || item.title;

    return (
        <article
            className="@container/file-row flex items-center gap-3 rounded-lg border border-border border-l-4 bg-card px-4 py-3"
            style={{ borderLeftColor: softAccent(accent) }}
        >
            <span
                className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: withAlpha(accent), color: accent }}
            >
                <FileTypeIcon fileName={fileName} className="size-5" aria-hidden="true" />
            </span>

            {/* Title and filename on the left, size and date on the right. The filename is the one
                string here with no length bound, so it goes on its own line with the row's full
                width rather than sharing a row where one of the two would be trimmed.

                Below 420px of row width the pair stacks: the icon, size, date and download button
                take their intrinsic width first and the title column absorbs the shortfall, which
                on a narrow phone leaves it too little to show either string. Stacking returns that
                width to the two strings that identify the item.

                Measured against the row's width, not the viewport: `FILE_ROW_GRID` splits the
                listing into two columns once `@container/app` reaches 860px, so a row is ~426px
                wide on a large screen — inside the 420px threshold, so the desktop two-column case
                keeps the side-by-side layout. */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 @min-[420px]/file-row:flex-row @min-[420px]/file-row:items-center @min-[420px]/file-row:gap-4">
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <h3 className="truncate font-medium">{item.title}</h3>
                        {item.isPinned && <PinnedBadge />}
                        {item.isFavorite && <FavoriteBadge />}
                    </div>

                    {/* The object's own name, shown only when it differs from the title, so a file
                        saved under its own name is not labelled twice. */}
                    {item.title !== fileName && (
                        <p className="truncate text-xs text-muted-foreground" title={fileName}>
                            {fileName}
                        </p>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground @min-[420px]/file-row:gap-4">
                    <span className="tabular-nums">{formatFileSize(item.fileSize)}</span>
                    <time dateTime={item.createdAt} className="tabular-nums">
                        {formatDate(item.createdAt)}
                    </time>
                </div>
            </div>

            <Button
                variant="ghost"
                size="sm"
                asChild
                // Same hover fill as the cards' copy button and the drawer toolbar: the ghost
                // variant's `bg-muted` is too close to the row underneath it to read as a hover.
                // Written twice because this project's `dark` variant (`&:is(.dark *)`) adds
                // specificity, so the plain rule loses to `dark:hover:bg-muted/50` without the
                // repeat.
                className="relative z-10 shrink-0 hover:bg-foreground/15 dark:hover:bg-foreground/15"
                title={`Download ${fileName}`}
            >
                <a href={`/api/files/${item.id}?download`} download={fileName}>
                    <Download aria-hidden="true" />
                    <span className="sr-only">Download {fileName}</span>
                </a>
            </Button>
        </article>
    );
}
