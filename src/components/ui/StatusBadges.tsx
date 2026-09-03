import { Pin, Star } from "lucide-react";

/**
 * The filled star that marks a thing as favourited, and the filled pin that marks an item as
 * pinned — one definition for the four cards and rows that render them (`ItemCard`, `ImageCard`,
 * `FileRow`, `CollectionCard`).
 *
 * Lives in `ui/` rather than `items/` because a collection card renders the star too. No
 * `"use client"` and no hooks: the four consumers are all server components, so this stays on that
 * side of the boundary with them.
 *
 * @remarks
 * A **filled** star asserts *this particular thing is favourited*; an outline star is the word
 * "favourites" as a place or a concept. `CollectionActions.tsx` states the same rule for its
 * toggle, and the two must agree.
 *
 * Both badges render the icon `aria-hidden` beside `sr-only` text rather than labelling the icon,
 * so the name is read as part of the heading's line instead of as a separate graphic.
 */
export function FavoriteBadge({ label = "Favorite" }: { label?: string }) {
    return (
        <>
            <Star className="size-3.5 shrink-0 fill-favorite text-favorite" aria-hidden="true" />
            <span className="sr-only">{label}</span>
        </>
    );
}

export function PinnedBadge() {
    return (
        <>
            <Pin className="size-3.5 shrink-0 fill-sky-400 text-sky-400" aria-hidden="true" />
            <span className="sr-only">Pinned</span>
        </>
    );
}
