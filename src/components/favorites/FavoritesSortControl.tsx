"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import {
    DEFAULT_SORT_DIRECTION,
    type FavoriteSort,
    type FavoriteSortKey,
} from "@/lib/favorites-sort";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Picks what `/favorites` is ordered by, and which way.
 *
 * A dropdown and a separate arrow rather than one menu of six combinations ("Name A–Z", "Name Z–A",
 * …): the key and the direction are two questions, and folding them into one list means the answer
 * to the second is buried in the wording of the first. It is a `DropdownMenu` rather than a `Select`
 * because there is no `select.tsx` in `components/ui` — the radio group here is the same primitive
 * `CollectionActions` already opens, and one sort control is not a reason to take on another
 * dependency.
 *
 * Changing the key resets the direction to that key's own default rather than carrying the previous
 * one across. Dates want newest first and names want A–Z, so any single shared default is backwards
 * for one of them — and going from date to name would otherwise land on Z–A, which reads as a bug
 * rather than as something the user asked for.
 */
const SORT_KEY_LABELS: Record<FavoriteSortKey, string> = {
    name: "Name",
    date: "Date",
    type: "Type",
};

export function FavoritesSortControl({
    sort,
    onSortChange,
}: {
    sort: FavoriteSort;
    onSortChange: (sort: FavoriteSort) => void;
}) {
    const isAscending = sort.direction === "asc";

    const selectKey = (key: string) => {
        const sortKey = key as FavoriteSortKey;

        onSortChange({ key: sortKey, direction: DEFAULT_SORT_DIRECTION[sortKey] });
    };

    const toggleDirection = () => {
        onSortChange({ ...sort, direction: isAscending ? "desc" : "asc" });
    };

    return (
        <div className="flex items-center gap-1">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                        <ArrowUpDown aria-hidden="true" />
                        Sort: {SORT_KEY_LABELS[sort.key]}
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuRadioGroup value={sort.key} onValueChange={selectKey}>
                        {Object.entries(SORT_KEY_LABELS).map(([key, label]) => (
                            <DropdownMenuRadioItem key={key} value={key}>
                                {label}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* The label names what clicking does, not what the arrow currently shows — a control
                announced as "Ascending" leaves a screen reader user to guess what pressing it means. */}
            <Button
                variant="outline"
                size="icon-sm"
                onClick={toggleDirection}
                title={isAscending ? "Sort descending" : "Sort ascending"}
            >
                {isAscending ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}
                <span className="sr-only">
                    {isAscending ? "Sort descending" : "Sort ascending"}
                </span>
            </Button>
        </div>
    );
}
