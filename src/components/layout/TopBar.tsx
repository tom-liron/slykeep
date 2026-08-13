"use client";

import Link from "next/link";
import { Menu, PanelLeft, Star } from "lucide-react";

import { CreateCollectionDialog } from "@/components/collections/CreateCollectionDialog";
import { CreateItemDialog } from "@/components/items/CreateItemDialog";
import { Brand } from "@/components/layout/Brand";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { useSidebar } from "@/components/layout/SidebarContext";
import { Button } from "@/components/ui/button";
import type { SearchDataViewModel } from "@/types/view-models";

export function TopBar({ searchData }: { searchData: SearchDataViewModel }) {
    const { toggleCollapsed, toggleMobile } = useSidebar();

    // Three tracks, not a row of siblings: from `sm` up the outer groups and the search are all
    // `flex-1`, so the two sides take an equal share whatever they contain — and once the search
    // hits its own `max-w`, the space it gives back is split evenly between them. That is what puts
    // the field on the middle of the page rather than wherever the brand and the toggles happen to
    // end.
    //
    // Neither outer track carries `min-w-0`, and that is the whole of what keeps this bar from
    // colliding with itself. `flex-1` is `flex: 1 1 0%`, so a track is *sized* as a third — but a
    // flex item's default `min-width: auto` stops it shrinking under its own contents, and the
    // buttons inside are `shrink-0`. Add `min-w-0` and the track shrinks anyway while its contents
    // do not, which puts them straight over the search field beside them. That is exactly what
    // happened, at every width where the create buttons still had their labels. The search is the
    // one track that *is* `min-w-0`: it has a placeholder it can clip and the others do not.
    //
    // Below `sm` the equal-thirds premise is dropped rather than patched. Centring only means
    // anything while there is slack to divide; narrow, the right-hand group is `shrink-0` and the
    // search collapses to an icon, which leaves the left track what is actually left over.
    return (
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-3 sm:gap-3 sm:px-4">
            <div className="flex flex-1 items-center gap-2 sm:gap-3">
                {/* Mobile: hamburger opens the drawer */}
                <Button
                    id="mobile-menu-button"
                    variant="ghost"
                    size="icon"
                    aria-label="Open menu"
                    onClick={toggleMobile}
                    className="shrink-0 md:hidden"
                >
                    <Menu className="size-5" aria-hidden="true" />
                </Button>

                {/* `compact`: the mark alone on a phone. The wordmark is the one thing in this
                    track with nothing to do at 390px, and hiding it is what a brand does at that
                    width — clipping it to "DevSt…" would just look broken. */}
                <Brand href="/" compact />

                {/* Desktop: collapse/expand the rail */}
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Toggle sidebar"
                    onClick={toggleCollapsed}
                    className="hidden shrink-0 md:inline-flex"
                >
                    <PanelLeft className="size-5" aria-hidden="true" />
                </Button>
            </div>

            {/* Renders the search field itself, as well as the palette behind it — the same shape
                the two create dialogs already have here, where the trigger belongs to the thing it
                opens. */}
            <CommandPalette data={searchData} />

            {/* `shrink-0` narrow and a third of the bar from `sm` up — and no `min-w-0` at either,
                for the reason given above: this is the group that was overlapping the search. */}
            <div className="flex shrink-0 items-center justify-end gap-2 sm:flex-1">
                {/* `aria-label` as well as `title`: the tooltip is for a pointer, and the star on its
                    own says nothing to a screen reader. Both, like the two toggles above.

                    Shown at every width. It was `hidden sm:inline-flex` for one release, on the
                    reasoning that Favorites is a destination and `SidebarNav` now carries it — but
                    the measurement behind that was taken before the search collapsed to an icon and
                    the wordmark to the mark, and once both landed the room was there. Measured at
                    320px, the narrowest screen worth designing for: every control plus the mark
                    comes to 204px inside a 296px box, so there is 92px spare. Hiding it cost a tap
                    on the phone, where the nav is a drawer behind the hamburger, and saved space
                    nothing needed. */}
                <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    aria-label="Favorites"
                    title="Favorites"
                >
                    <Link href="/favorites">
                        <Star className="size-5" aria-hidden="true" />
                    </Link>
                </Button>
                <CreateCollectionDialog />
                <CreateItemDialog />
            </div>
        </header>
    );
}
