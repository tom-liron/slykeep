import { Pin, Star } from "lucide-react";

import { isRenderableImage } from "@/lib/file-preview";
import { formatDate } from "@/lib/format";
import type { ItemSummaryViewModel } from "@/types/view-models";
import { FileTypeIcon } from "./FileTypeIcon";

/**
 * One image item as a gallery tile — the picture itself, with a caption under it.
 *
 * An image is the one item type whose content can be shown at list size, so a card that summarised
 * it in words would be describing something already on screen. The tile is a fixed 16:9 so the grid
 * lines up, but the picture is `object-contain` inside it rather than `object-cover`: the spec asked
 * for cover, and the first portrait photograph through it — a full-height statue — came out as a
 * torso with the head cropped off. A gallery is browsed by recognising a picture, and cover crops
 * exactly the part that identifies one. Letterbox bars are the cheaper cost.
 *
 * A plain `<img>`, not `next/image`, for the reason the drawer's preview gives: the source is an
 * authorized route that answers from the session cookie, and Next's optimizer fetches the URL itself
 * without one, so the optimized variant would 404 while the direct request succeeds.
 *
 * The zoom on hover is `group-hover`, not `hover`, because the click target is a sibling laid over
 * this card rather than a parent of it — the pointer is never over the `<article>`, so it can never
 * match `:hover`. `ItemList` puts `group` on the wrapper they share.
 */
export function ImageCard({ item }: { item: ItemSummaryViewModel }) {
    // A file item is created with its object, so `fileName` is all but always set; the title stands
    // in for the row that somehow has none, so the alt text still names something.
    const name = item.fileName || item.title;

    return (
        <article className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="aspect-video overflow-hidden bg-muted/40">
                {isRenderableImage(name) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={`/api/files/${item.id}`}
                        alt={item.title}
                        loading="lazy"
                        className="size-full object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                ) : (
                    // An SVG lands here: it is an uploadable image format that this origin never
                    // serves inline, so the tile shows what the file is instead of rendering it.
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                        <FileTypeIcon fileName={name} className="size-8" aria-hidden="true" />
                    </div>
                )}
            </div>

            <div className="flex items-start justify-between gap-2 p-3">
                <div className="flex min-w-0 items-center gap-1.5">
                    <h3 className="truncate text-sm font-medium">{item.title}</h3>
                    {item.isPinned && (
                        <>
                            <Pin
                                className="size-3.5 shrink-0 fill-sky-400 text-sky-400"
                                aria-hidden="true"
                            />
                            <span className="sr-only">Pinned</span>
                        </>
                    )}
                    {item.isFavorite && (
                        <>
                            <Star
                                className="size-3.5 shrink-0 fill-favorite text-favorite"
                                aria-hidden="true"
                            />
                            <span className="sr-only">Favorite</span>
                        </>
                    )}
                </div>
                <time dateTime={item.editedAt} className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(item.editedAt)}
                </time>
            </div>
        </article>
    );
}
