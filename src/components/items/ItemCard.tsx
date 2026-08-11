import { Pin, Star } from "lucide-react";

import { formatDate } from "@/lib/format";
import { cn, withAlpha } from "@/lib/utils";
import type { ItemSummaryViewModel } from "@/types/view-models";
import { TypeIcon } from "./TypeIcon";

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
        <article
            className="flex gap-3 rounded-xl border border-border border-l-4 bg-card p-4"
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
                                    className="size-3.5 shrink-0 fill-yellow-400 text-yellow-400"
                                    aria-hidden="true"
                                />
                                <span className="sr-only">Favorite</span>
                            </>
                        )}
                    </div>
                    {/* Gives way to the copy button, which `ItemList` puts in this corner on hover
                        and on focus — but only when there is one, or hovering a card whose item has
                        nothing to copy would fade the date out and leave an empty corner.
                        `group-*` rather than `hover:` because the pointer is never over this card:
                        a sibling covers it. */}
                    <time
                        dateTime={item.updatedAt}
                        className={cn(
                            "shrink-0 text-xs text-muted-foreground",
                            showsCopy &&
                                "transition-opacity group-hover:opacity-0 group-focus-within:opacity-0",
                        )}
                    >
                        {formatDate(item.updatedAt)}
                    </time>
                </div>

                <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                    {item.description}
                </p>

                {item.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.tags.map((tag) => (
                            <span
                                key={`${item.id}-${tag}`}
                                className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </article>
    );
}
