import { formatDate } from "@/lib/format";
import type { ItemSummaryViewModel } from "@/types/view-models";
import { TypeIcon } from "./TypeIcon";

/**
 * One item as a dense line: type icon, title, type badge, date.
 *
 * The flattest of the shapes `ItemList` can render, used by the favorites list — a list scanned for
 * a known title, where many rows on screen beats fewer cards carrying descriptions and tags.
 *
 * @remarks
 * The title and date are monospaced so they line up into columns with no rule drawn between them;
 * the badge stays proportional as a label. No star: every row here is already a favourite, so a
 * star on all of them would mark nothing.
 */
export function ItemRow({ item }: { item: ItemSummaryViewModel }) {
    const accent = item.itemType.color;

    return (
        <div className="flex items-center gap-3 px-3 py-2 pointer-coarse:py-3">
            <TypeIcon
                name={item.itemType.icon}
                className="size-4 shrink-0"
                style={{ color: accent }}
                aria-hidden="true"
            />

            <span className="min-w-0 flex-1 truncate font-mono text-sm">{item.title}</span>

            {/* Badge and date sit together in a fixed-width group, not at the row's far edge, so
                they form two straight columns down the list rather than tracking the title's
                `flex-1` width. */}
            <div className="flex shrink-0 items-center gap-3">
                {/* Coloured by the item type, like a card's left border and a collection's accent:
                    the colour is configuration, so it arrives as a runtime value Tailwind has no
                    class for. */}
                <span
                    className="hidden w-20 justify-center rounded-md border px-1.5 py-0.5 text-xs sm:inline-flex"
                    style={{ borderColor: accent, color: accent }}
                >
                    {item.itemType.label}
                </span>

                <time
                    dateTime={item.editedAt}
                    className="w-14 text-right font-mono text-xs text-muted-foreground"
                >
                    {formatDate(item.editedAt)}
                </time>
            </div>
        </div>
    );
}
