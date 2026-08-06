import { Download, Pin, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDate, formatFileSize } from "@/lib/format";
import { withAlpha } from "@/lib/utils";
import type { ItemSummaryViewModel } from "@/types/view-models";
import { FileTypeIcon } from "./FileTypeIcon";

/**
 * One uploaded object as a list row — the file manager reading of an item, where a card is the wrong
 * shape: what matters about a file is its name, its size, and when it arrived, and those line up
 * across rows so they can be compared down a column.
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
    // fallback for the row that somehow has none, rather than a blank line where a name goes.
    const name = item.fileName || item.title;

    return (
        <article
            className="flex items-center gap-3 rounded-lg border border-border border-l-4 bg-card px-4 py-3"
            style={{ borderLeftColor: accent }}
        >
            <span
                className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: withAlpha(accent), color: accent }}
            >
                <FileTypeIcon fileName={name} className="size-5" aria-hidden="true" />
            </span>

            {/* Name and metadata are one column on mobile and one row from `sm` up: a filename, a
                size, and a date do not fit side by side on a phone without truncating the only part
                that identifies the file. */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <h3 className="truncate font-medium">{name}</h3>
                    {item.isPinned && (
                        <>
                            <Pin
                                className="size-3.5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <span className="sr-only">Pinned</span>
                        </>
                    )}
                    {item.isFavorite && (
                        <>
                            <Star
                                className="size-3.5 shrink-0 fill-yellow-400 text-yellow-400"
                                aria-hidden="true"
                            />
                            <span className="sr-only">Favorite</span>
                        </>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                    {/* The item's own title, which the filename replaced as the heading. Shown only
                        when the two differ, so a file stashed under its own name is not labelled
                        twice. */}
                    {item.title !== name && <span className="max-w-40 truncate">{item.title}</span>}
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
                title={`Download ${name}`}
            >
                <a href={`/api/files/${item.id}?download`} download={name}>
                    <Download aria-hidden="true" />
                    <span className="sr-only">Download {name}</span>
                </a>
            </Button>
        </article>
    );
}
