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
 * The client-side sort control for `/favorites`: a `DropdownMenu` of sort keys and a separate
 * direction toggle.
 *
 * Rendered by `FavoritesView`, which holds the sort state and re-orders both lists from it. Key
 * and direction are two controls, not one list of every combination.
 *
 * @remarks
 * Changing the key resets the direction to that key's default (from `DEFAULT_SORT_DIRECTION`):
 * dates want newest first and names want A–Z, so carrying the old direction across would land one
 * of them backwards.
 */

/** The visible label for each sort key. */
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
