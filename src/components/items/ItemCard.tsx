import { FavoriteBadge, PinnedBadge } from "@/components/ui/StatusBadges";
import { formatDate } from "@/lib/format";
import { cn, withAlpha } from "@/lib/utils";
import type { ItemSummaryViewModel } from "@/types/view-models";
import { TypeIcon } from "./TypeIcon";

/**
 * How many tags a card shows before the rest become a count.
 *
 * Two, because two is what fits on one line at the narrowest column `CARD_GRID` produces — three
 * columns inside the app shell — and one line is the whole point: see the tag row below.
 *
 * A fixed count rather than "as many as fit". Measuring would mean laying the chips out, reading
 * their widths, and re-rendering, which needs a client component and a `ResizeObserver` for a card
 * that is otherwise pure markup rendered on the server. A count is deterministic, costs nothing,
 * and is wrong only in the narrow case of two unusually long tags — which the row's `overflow-hidden`
 * absorbs rather than reflowing the grid.
 */
const MAX_VISIBLE_TAGS = 2;

/**
 * `showsCopy` says whether a copy button will be laid over this card's top-right corner, which is
 * where the timestamp is — the date gives way to it on hover, and must not give way to nothing. Not
 * every card gets one: `ItemList` renders items of every type through this component on the
 * dashboard and on a collection page, and an image or a PDF has nothing to copy.
 */
export function ItemCard({
    item,
    showsCopy = false,
}: {
    item: ItemSummaryViewModel;
    showsCopy?: boolean;
}) {
    const accent = item.itemType.color;

    return (
        // `h-full` because this card is **not** the grid item — `ItemList` wraps every entry in a
        // `group relative` div to carry the click overlay, and that wrapper is what `CARD_GRID`
        // lays out. A grid stretches its own children, so the wrapper already grows to the tallest
        // card in its row; without this, the article inside sizes to its own content and sits in a
        // taller box, which is why one card with three tags left its two row-mates visibly short.
        // `CollectionCard` never had the bug for the same reason inverted: it *is* the grid item.
        //
        // Safe in the stacked lists too, where the dashboard renders these under `space-y-3`: the
        // wrapper's height is `auto` there, and a percentage height against an auto parent resolves
        // back to `auto`, so this changes nothing outside a grid.
        <article
            className="flex h-full gap-3 rounded-xl border border-border border-l-4 bg-card p-4"
            style={{ borderLeftColor: accent }}
        >
            <span
                className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: withAlpha(accent), color: accent }}
            >
                <TypeIcon name={item.itemType.icon} className="size-5" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <h3 className="truncate font-medium">{item.title}</h3>
                        {item.isPinned && <PinnedBadge />}
                        {item.isFavorite && <FavoriteBadge />}
                    </div>
                    {/* Gives way to the copy button, which `ItemList` puts in this corner on hover
                        and on focus — but only when there is one, or hovering a card whose item has
                        nothing to copy would fade the date out and leave an empty corner.
                        `group-*` rather than `hover:` because the pointer is never over this card:
                        a sibling covers it. */}
                    <time
                        dateTime={item.editedAt}
                        className={cn(
                            "shrink-0 text-xs text-muted-foreground",
                            showsCopy &&
                                "transition-opacity group-hover:opacity-0 group-focus-within:opacity-0",
                        )}
                    >
                        {formatDate(item.editedAt)}
                    </time>
                </div>

                <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                    {item.description}
                </p>

                {/* One line, always — and always present, even for an item with no tags at all.
                    This row is the only part of the card whose height can vary: the title is
                    `truncate` and the description is `line-clamp-1`, both deliberately, so every
                    other line is fixed. Left wrapping, it was the one thing making a card taller
                    than the two beside it.

                    That matters more than it looks. `CARD_GRID` is paginated, so a grid that sizes
                    itself to its tallest card changes height between pages — the same list rendered
                    at a different size on page 2. Pinning the row here means a card is the same
                    height at six items and at six hundred, which is how a product grid is normally
                    built: normalise the content, rather than stretch the container around it.

                    `h-5` is one chip: `text-xs` at a 1rem line box plus `py-0.5` either side. It is
                    stated as a height rather than left to the content precisely so that the empty
                    case still occupies it. */}
                <div className="mt-2 flex h-5 items-center gap-1.5 overflow-hidden">
                    {item.tags.slice(0, MAX_VISIBLE_TAGS).map((tag) => (
                        <span
                            key={`${item.id}-${tag}`}
                            // `shrink-0` so two tags keep their own width and the second is clipped
                            // by the row instead of both being squeezed into illegibility; `max-w`
                            // and `truncate` so one very long tag cannot take the whole line.
                            className="max-w-32 shrink-0 truncate rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                        >
                            {tag}
                        </span>
                    ))}
                    {/* The count, not the tags themselves. Nothing is lost by hiding them: the
                        drawer this card opens lists every tag the item has, and the card's job is
                        to be scannable rather than complete. */}
                    {item.tags.length > MAX_VISIBLE_TAGS && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                            +{item.tags.length - MAX_VISIBLE_TAGS}
                        </span>
                    )}
                </div>
            </div>
        </article>
    );
}
