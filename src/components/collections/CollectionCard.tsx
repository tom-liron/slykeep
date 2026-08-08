import Link from "next/link";
import { Star } from "lucide-react";

import { TypeIcon } from "@/components/items/TypeIcon";
import type { CollectionViewModel } from "@/types/view-models";

export function CollectionCard({ collection }: { collection: CollectionViewModel }) {
    const accent = collection.dominantItemType?.color;

    return (
        <Link
            href={`/collections/${collection.id}`}
            className="flex flex-col rounded-xl border border-border border-l-4 bg-card p-4 transition-colors hover:bg-muted/50"
            style={accent ? { borderLeftColor: accent } : undefined}
        >
            <div className="flex items-center gap-1.5">
                <h3 className="truncate font-semibold">{collection.name}</h3>
                {collection.isFavorite && (
                    <>
                        <Star
                            className="size-3.5 shrink-0 fill-yellow-400 text-yellow-400"
                            aria-hidden="true"
                        />
                        <span className="sr-only">Favorite</span>
                    </>
                )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{collection.itemCount} items</p>
            {/* Guarded rather than always rendered: the view model normalizes a null description to
                "", and until collections could be created there was no way to have one — every
                seeded collection carries a description. The create dialog makes the field optional,
                so an empty paragraph (and its margin) is now reachable. */}
            {collection.description && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {collection.description}
                </p>
            )}
            <div className="mt-4 flex items-center gap-2">
                {collection.itemTypes.map((itemType) => (
                    <TypeIcon
                        key={itemType.id}
                        name={itemType.icon}
                        className="size-4"
                        style={{ color: itemType.color }}
                        aria-hidden="true"
                    />
                ))}
            </div>
        </Link>
    );
}
