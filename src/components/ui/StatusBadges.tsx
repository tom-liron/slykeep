import { Pin, Star } from "lucide-react";

/**
 * The filled star that marks a thing as favourited, and the filled pin that marks an item as
 * pinned — one definition for the four cards and rows that render them.
 *
 * These carry a rule the whole app follows, stated at length in `CollectionActions.tsx`: a
 * **filled** star asserts *this particular thing is favourited*, while an outline star is the word
 * "favourites" as a place or a concept. That rule was got wrong once and revised, and four
 * hand-written copies of the markup is the shape in which it gets got wrong again — retuning
 * `--favorite`, or changing the pin's colour, meant finding three files by grep.
 *
 * Lives in `ui/` rather than `items/` because a collection card renders the star too. Deliberately
 * carries no `"use client"` and no hooks: `ItemCard`, `ImageCard` and `FileRow` are server
 * components, and an extraction that pushed them across that boundary would be a worse trade than
 * the duplication it removed.
 *
 * Both render the icon `aria-hidden` beside `sr-only` text rather than labelling the icon, so the
 * name is read as part of the heading's line instead of as a separate graphic.
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
