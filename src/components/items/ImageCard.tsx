import { FavoriteBadge, PinnedBadge } from "@/components/ui/StatusBadges";
import { isRenderableImage } from "@/lib/file-preview";
import { formatDate } from "@/lib/format";
import type { ItemSummaryViewModel } from "@/types/view-models";
import { FileTypeIcon } from "./FileTypeIcon";

/**
 * One image item as a gallery tile — the picture itself, with a caption under it.
 *
 * The list shape for the `image` type: an image is the one item type whose content shows at list
 * size, so this renders the picture rather than a worded summary. `ItemList` chooses it for that
 * type.
 *
 * @remarks
 * The tile is a fixed 16:9 for grid alignment, and the picture is `object-contain` inside it: a
 * gallery is browsed by recognising a picture, and `object-cover` crops the part that identifies
 * one. Letterbox bars are the trade.
 *
 * A plain `<img>`, not `next/image` — the same reason `FilePreview` gives: the source is an
 * authorized route that reads the session cookie, and Next's optimizer fetches the URL without
 * one, so the optimized variant 404s.
 *
 * The hover zoom is `group-hover`, not `hover`: the click target is a sibling laid over this card,
 * so the pointer is never over the `<article>`. `ItemList` puts `group` on the shared wrapper.
 */
export function ImageCard({ item }: { item: ItemSummaryViewModel }) {
    // A file item is created with its object, so `fileName` is almost always set; the title stands
    // in when a row has none, so the alt text still names something.
    const name = item.fileName || item.title;

    return (
        // `h-full` so every tile in a grid row matches height — the grid item is the wrapper
        // `ItemList` puts around this, not the article. See `ItemCard` for the fuller note.
        <article className="h-full overflow-hidden rounded-xl border border-border bg-card">
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
                    {item.isPinned && <PinnedBadge />}
                    {item.isFavorite && <FavoriteBadge />}
                </div>
                <time dateTime={item.editedAt} className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(item.editedAt)}
                </time>
            </div>
        </article>
    );
}
