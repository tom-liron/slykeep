import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FavoriteBadge, PinnedBadge } from "@/components/ui/StatusBadges";
import { formatDate, formatFileSize } from "@/lib/format";
import { withAlpha } from "@/lib/utils";
import type { ItemSummaryViewModel } from "@/types/view-models";
import { FileTypeIcon } from "./FileTypeIcon";

/**
 * One uploaded object as a list row — the file manager reading of an item, where a card is the wrong
 * shape: what matters about a file is what it is, how big it is, and when it arrived, and those line
 * up across rows so they can be compared down a column.
 *
 * The item's *title* is the heading and the object's filename is metadata beside the size and date,
 * the same way a drive shows a file that has been renamed. It began the other way round, on the
 * reasoning that a file is identified by its name — but an uploaded name is whatever the browser
 * handed over, so the first real PDF through it made the row's largest text
 * `12+Rules+to+Learn+to+Code+[2nd+Edition]+2022.pdf` while the name a person actually chose sat in
 * grey at the far right.
 *
 * Rendered inside `ItemList`, which lays a full-row button over each entry to open the drawer. That
 * is why Download is the one thing here that is positioned: `relative z-10` lifts the anchor above
 * that overlay, so the click that downloads never reaches the trigger underneath. Nothing is nested
 * inside anything else, so there is no event to stop propagating — the two controls are siblings that
 * simply overlap.
 */
export function FileRow({ item }: { item: ItemSummaryViewModel }) {
    const accent = item.itemType.color;

    // A file item is created with its object, so `fileName` is all but always set; the title is the
    // fallback for the row that somehow has none, rather than a blank line where a name goes. This
    // is the *object's* name — what the icon is chosen from and what a download is saved as — and it
    // is not the row's heading. See below.
    const fileName = item.fileName || item.title;

    return (
        <article
            className="@container/file-row flex items-center gap-3 rounded-lg border border-border border-l-4 bg-card px-4 py-3"
            style={{ borderLeftColor: accent }}
        >
            <span
                className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: withAlpha(accent), color: accent }}
            >
                <FileTypeIcon fileName={fileName} className="size-5" aria-hidden="true" />
            </span>

            {/* Two lines on the left, size and date on the right. The filename sits under the title
                rather than beside it because it is the one string here with no bound on its length —
                sharing a row with the title meant whichever of the two moved first got trimmed; on
                its own line it has the width of the row to itself.

                Below 420px of row the same pair stacks instead, because side by side there is no
                width left to divide: the icon, the size, the date and the download button all take
                their intrinsic width first, and the title column — the only flexible one — absorbs
                the entire shortfall. On a 382px phone that left it 62px, so the heading rendered as
                `J…` and the filename under it vanished. Stacking hands those 62px back to the two
                strings that say which item this is, and drops the size and date onto their own line,
                where they cost a line of height and lose only their alignment down the column.

                Measured against the row's own width and not the viewport: `FILE_ROW_GRID` splits the
                listing into two columns once `@container/app` reaches 860px, so a row is ~426px wide
                on a large screen — a `sm:` breakpoint would be answering a question about the window
                that this row is not asking. 420 is the width at which the title still has ~150px
                left beside the metadata, which puts the two-column desktop case just inside it. */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 @min-[420px]/file-row:flex-row @min-[420px]/file-row:items-center @min-[420px]/file-row:gap-4">
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <h3 className="truncate font-medium">{item.title}</h3>
                        {item.isPinned && <PinnedBadge />}
                        {item.isFavorite && <FavoriteBadge />}
                    </div>

                    {/* The name of the object itself — the way a drive shows a file that has been
                        given a name of its own. An upload keeps whatever the browser handed over, so
                        it is the noisier of the two strings
                        (`12+Rules+to+Learn+to+Code+[2nd+Edition]+2022.pdf`) and the title is what a
                        person chose; the heading is the chosen one. Shown only when the two differ,
                        so a file stashed under its own name is not labelled twice. */}
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
                className="relative z-10 shrink-0"
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
