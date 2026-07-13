import { Pin, Star } from "lucide-react";

import { TypeIcon } from "@/components/layout/TypeIcon";
import { formatDate, getType } from "@/lib/dashboard";
import type { Item } from "@/lib/mock-data";

/**
 * Item row card: type-colored left border and icon badge, title with pin/star
 * markers, description, tags, and the last-updated date. Display-only for now —
 * the edit/view drawer arrives in a later phase.
 */
export function ItemCard({ item }: { item: Item }) {
    const type = getType(item.typeId);
    const accent = type?.color ?? "#6b7280";

    return (
        <article
            className="flex gap-3 rounded-xl border border-border border-l-4 bg-card p-4 transition-colors hover:bg-muted/50"
            style={{ borderLeftColor: accent }}
        >
            <span
                className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${accent}1a`, color: accent }}
            >
                {type && <TypeIcon name={type.icon} className="size-5" />}
            </span>

            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <h3 className="truncate font-medium">{item.title}</h3>
                        {item.isPinned && (
                            <Pin className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        {item.isFavorite && (
                            <Star className="size-3.5 shrink-0 fill-yellow-400 text-yellow-400" />
                        )}
                    </div>
                    <time className="shrink-0 text-xs text-muted-foreground">
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
                                key={tag}
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
