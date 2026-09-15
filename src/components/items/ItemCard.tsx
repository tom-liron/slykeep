import { FavoriteBadge, PinnedBadge } from "@/components/ui/StatusBadges";
import { formatDate } from "@/lib/format";
import { cn, softAccent, withAlpha } from "@/lib/utils";
import type { ItemSummaryViewModel } from "@/types/view-models";
import { TypeIcon } from "./TypeIcon";

/**
 * The default item-summary card: type icon and accent, title, one-line description, and a tag row.
 *
 * The `"card"` shape `ItemList` renders for every text and link type on the dashboard and on
 * collection pages. A server-rendered `<article>` with no interactivity of its own — `ItemList`
 * lays the click overlay and the copy button over it. `CollectionCard` is the collection
 * equivalent.
 *
 * @remarks
 * Every line except the tag row is fixed height (`truncate` title, `line-clamp-1` description), so
 * cards in a paginated `CARD_GRID` stay the same height from one page to the next.
 */

/**
 * Tags shown on a card before the rest collapse to a `+N` count.
 *
 * Two is what fits on one line at the narrowest column `CARD_GRID` produces (three columns in the
 * app shell). A fixed count keeps the card server-rendered with no measurement; the row's
 * `overflow-hidden` absorbs the rare case of two unusually long tags.
 */
const MAX_VISIBLE_TAGS = 2;

/**
 * @param showsCopy - Whether `ItemList` will lay a copy button over this card's top-right corner.
 * When true, the timestamp in that corner fades out on hover/focus to make room for it; the card
 * must not fade the date for a button that is not there.
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
        // `h-full` so every card in a grid row matches the tallest. The grid item is `ItemList`'s
        // `group relative` wrapper, not this article, and the grid stretches that wrapper; without
        // `h-full` the article sizes to its own content inside a taller box. In the stacked lists
        // the wrapper's height is `auto`, against which a percentage height resolves back to
        // `auto`, so this is a no-op outside a grid.
        <article
            className="flex h-full gap-3 rounded-xl border border-border border-l-4 bg-card p-4"
            style={{ borderLeftColor: softAccent(accent) }}
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
                    {/* Fades out for the copy button `ItemList` puts in this corner on
                        hover/focus, and only when `showsCopy` — otherwise a card with nothing to
                        copy would fade its date to an empty corner. `group-*`, not `hover:`,
                        because a sibling overlay covers this card so it never matches `:hover`.
                        `pointer-coarse:opacity-0` pairs with the button being always-on under a
                        coarse pointer (see `ItemList`), so the two never share the corner. The
                        drawer shows both dates in full. */}
                    <time
                        dateTime={item.editedAt}
                        className={cn(
                            "shrink-0 text-xs text-muted-foreground",
                            showsCopy &&
                                "transition-opacity group-hover:opacity-0 group-focus-within:opacity-0 pointer-coarse:opacity-0",
                        )}
                    >
                        {formatDate(item.editedAt)}
                    </time>
                </div>

                <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                    {item.description}
                </p>

                {/* One line, always present even for an item with no tags. This row is the only
                    part of the card whose height could vary, and a paginated `CARD_GRID` that
                    sized to its tallest card would change height between pages. `h-5` is one chip
                    (`text-xs` on a 1rem line box plus `py-0.5`), stated as a height so the empty
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
                    {/* A count, not the tags themselves — the drawer this card opens lists every
                        tag. */}
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
