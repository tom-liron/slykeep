import { Pin, Star } from "lucide-react";

import { formatDate } from "@/lib/format";
import { withAlpha } from "@/lib/utils";
import type { ItemViewModel } from "@/types/view-models";
import { TypeIcon } from "./TypeIcon";

export function ItemCard({ item }: { item: ItemViewModel }) {
    const accent = item.itemType.color;

    return (
        <article
            id={item.id}
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
                    <time
                        dateTime={item.updatedAt}
                        className="shrink-0 text-xs text-muted-foreground"
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
