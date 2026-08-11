import { formatDate } from "@/lib/format";
import type { ItemSummaryViewModel } from "@/types/view-models";
import { TypeIcon } from "./TypeIcon";

/**
 * One item as a dense line: type icon, title, type badge, date.
 *
 * The fourth shape `ItemList` can render, and the flattest — a card describes an item, this one only
 * identifies it. That is the trade the favourites list wants: a list you scan for a title you already
 * know, where forty rows on screen beats eight cards with descriptions and tags.
 *
 * Monospace on the title and the date, on purpose. Both are things a developer reads as data rather
 * than prose, and a fixed advance is what makes a column of them line up when nothing here draws a
 * column rule. The badge stays proportional — it is a label, not a value.
 *
 * No star. Every row that reaches this component is a favourite, so a filled star on all of them
 * would be decoration marking nothing, unlike on a card, where it distinguishes one card from its
 * neighbours.
 */
export function ItemRow({ item }: { item: ItemSummaryViewModel }) {
    const accent = item.itemType.color;

    return (
        <div className="flex items-center gap-3 px-3 py-2">
            <TypeIcon
                name={item.itemType.icon}
                className="size-4 shrink-0"
                style={{ color: accent }}
                aria-hidden="true"
            />

            <span className="min-w-0 flex-1 truncate font-mono text-sm">{item.title}</span>

            {/* The badge and the date travel together rather than sitting at opposite ends of the
                row: they are both metadata about the same line, and `flex-1` on the title was
                throwing them as far apart as the viewport allowed. Both get a fixed width so they
                form two straight columns down the list — a ragged right edge is what made a dense
                list look loose. */}
            <div className="flex shrink-0 items-center gap-3">
                {/* Coloured by the type rather than by a variant, the same way a card's left border
                    and a collection's accent are: the colour is the type's, and it is
                    configuration, so it arrives as a runtime value Tailwind cannot have a class
                    for. */}
                <span
                    className="hidden w-20 justify-center rounded-md border px-1.5 py-0.5 text-xs sm:inline-flex"
                    style={{ borderColor: accent, color: accent }}
                >
                    {item.itemType.label}
                </span>

                <time
                    dateTime={item.updatedAt}
                    className="w-14 text-right font-mono text-xs text-muted-foreground"
                >
                    {formatDate(item.updatedAt)}
                </time>
            </div>
        </div>
    );
}
