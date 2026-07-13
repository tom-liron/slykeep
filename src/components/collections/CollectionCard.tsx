import Link from "next/link";
import { Star } from "lucide-react";

import { TypeIcon } from "@/components/layout/TypeIcon";
import { FALLBACK_TYPE_COLOR } from "@/config/item-types";
import { getItemCountInCollection } from "@/lib/dashboard";
import { getType } from "@/lib/item-types";
import type { Collection } from "@/types/item";

/**
 * Collection card with a left border in the color of the type it holds most of
 * (first entry in `typeIds`), plus a row of the type icons it contains.
 */
export function CollectionCard({ collection }: { collection: Collection }) {
    const dominant = getType(collection.typeIds[0]);
    const accent = dominant?.color ?? FALLBACK_TYPE_COLOR;
    const itemCount = getItemCountInCollection(collection.id);

    return (
        <Link
            href={`/collections/${collection.id}`}
            className="flex flex-col rounded-xl border border-border border-l-4 bg-card p-4 transition-colors hover:bg-muted/50"
            style={{ borderLeftColor: accent }}
        >
            <div className="flex items-center gap-1.5">
                <h3 className="truncate font-semibold">{collection.name}</h3>
                {collection.isFavorite && (
                    <Star className="size-3.5 shrink-0 fill-yellow-400 text-yellow-400" />
                )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{itemCount} items</p>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {collection.description}
            </p>
            <div className="mt-4 flex items-center gap-2">
                {collection.typeIds.map((typeId) => {
                    const type = getType(typeId);
                    if (!type) return null;
                    return (
                        <TypeIcon
                            key={typeId}
                            name={type.icon}
                            className="size-4"
                            style={{ color: type.color }}
                        />
                    );
                })}
            </div>
        </Link>
    );
}
