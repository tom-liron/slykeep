"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderPlus, Menu, PanelLeft, Plus, Star, Zap } from "lucide-react";

import { CreateCollectionDialog } from "@/components/collections/CreateCollectionDialog";
import { CreateItemDialog } from "@/components/items/CreateItemDialog";
import { Brand } from "@/components/layout/Brand";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { useSidebar } from "@/components/layout/SidebarContext";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SearchDataViewModel } from "@/types/view-models";

export function TopBar({
    searchData,
    isPro,
}: {
    searchData: SearchDataViewModel;
    /** Free accounts get an Upgrade control; a subscriber has nothing to upgrade to. */
    isPro: boolean;
}) {
    const { toggleCollapsed, toggleMobile } = useSidebar();

    // The bar owns the create buttons now, rather than each dialog carrying its own trigger. It has
    // to: below `sm` the two buttons are one menu, and a menu item cannot be a dialog's trigger and
    // a menu item at once.
    const [newItemOpen, setNewItemOpen] = useState(false);
    const [newCollectionOpen, setNewCollectionOpen] = useState(false);

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
        // `sticky` below `md`, static above it. From `md` up the bar is a row of a pinned frame and
        // already cannot move, so sticky would be inert; below that the document scrolls underneath
        // it and this is what keeps search and the create actions reachable without scrolling back
        // up. `bg-background` comes with it — the bar was transparent over a body that never moved,
        // and content sliding under a transparent bar is the one way this change can look broken.
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background px-3 sm:gap-3 sm:px-4 md:static">
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
                {/* The one route to checkout from inside the app that is not Settings or a locked
                    item type. Ghost, and first in the group, so it stays clear of the two create
                    buttons — those are what this bar is *for*, and an upgrade prompt that competes
                    with them is an advertisement in a workspace.

                    `hidden sm:inline-flex`, and that is not a style choice: the measurements below
                    record this group at zero slack on a 360px phone with six targets already in it.
                    A seventh would clip the primary "+" off the edge. Free accounts on a phone
                    reach checkout from Settings or by opening a Pro item type, both of which lead
                    to the same place. */}
                {!isPro && (
                    <Button
                        variant="ghost"
                        asChild
                        // `purple-300` is the tone the pricing cards already use for Pro, so the
                        // one coloured control in this bar is coloured out of the palette Pro is
                        // presented in everywhere else. It is also the *only* colour here: the star
                        // beside it stays neutral, because two tinted controls side by side read as
                        // decoration rather than as one thing being different.
                        //
                        // `Zap` rather than a sparkle: sparkles have come to mean AI specifically,
                        // and this leads to a price list.
                        className="hidden shrink-0 gap-1.5 text-purple-300 hover:bg-purple-500/15 hover:text-purple-200 sm:inline-flex"
                    >
                        <Link href="/upgrade">
                            <Zap className="size-4" aria-hidden="true" />
                            Upgrade
                        </Link>
                    </Button>
                )}

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
                    // Full `muted` on hover rather than the ghost variant's `muted/50`, which
                    // against this background is very nearly the background — the control looked
                    // inert until the cursor was already on it.
                    //
                    // `hover:text-foreground` comes off with it: the star sets its own colour, so
                    // the variant's hover would only have fought it.
                    className="hover:bg-muted dark:hover:bg-muted"
                >
                    <Link href="/favorites">
                        {/* `--favorite`, the same colour and the same outline as every other star
                            in the app — the sidebar's Favorites row, the badge on a card or a row,
                            and both toggles.

                            Held at 80% at rest, and only here. This star sits on bare bar next to
                            Upgrade, where the others sit on a card or a tinted chip that already
                            takes the edge off them; at full strength it read as the brightest thing
                            in the bar and pulled against the one control that is meant to be. Hover
                            resolves it to the exact shared colour, so the difference is a resting
                            state rather than a second yellow. */}
                        <Star
                            className="size-5 text-favorite/80 transition-colors group-hover/button:text-favorite"
                            aria-hidden="true"
                        />
                    </Link>
                </Button>

                {/* The divider is the point of this group's ordering: navigation on the left of it,
                    the two things that create something on the right. Without it Upgrade and
                    Favorites read as part of the same set as New Collection and New Item, which is
                    what made four controls in a row feel undifferentiated. */}
                <span
                    aria-hidden="true"
                    className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block"
                />
                {/* Below `sm`, one create control instead of two.

                    Measured at 360px with touch-sized targets: the hamburger, the brand mark, the
                    search icon, the star and both create buttons came to 345px of a 345px bar —
                    zero slack — and on a 375px iPhone the primary "+" was clipped by the right
                    edge. Six 44px targets do not fit a phone, and the two create buttons are the
                    right pair to merge: they are the only two that mean the same verb, and
                    icon-only they were already two unlabelled buttons that both read as "new".
                    One menu is 52px cheaper and says which is which.

                    From `sm` up nothing changes — both buttons are back, in the same order, with
                    the same labels appearing at `lg`. */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button aria-label="Create" title="Create" className="sm:hidden">
                            <Plus className="size-4" aria-hidden="true" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setNewItemOpen(true)}>
                            <Plus className="size-4" aria-hidden="true" />
                            New item
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setNewCollectionOpen(true)}>
                            <FolderPlus className="size-4" aria-hidden="true" />
                            New collection
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button
                    variant="outline"
                    aria-label="New Collection"
                    onClick={() => setNewCollectionOpen(true)}
                    className="hidden sm:inline-flex"
                >
                    <FolderPlus className="size-4" aria-hidden="true" />
                    {/* `lg`, measured: the labelled pair needs ~250px, and with the brand, the
                        search field and the star beside them the bar only has that from ~900px. */}
                    <span className="hidden lg:inline">New Collection</span>
                </Button>
                <Button
                    aria-label="New Item"
                    onClick={() => setNewItemOpen(true)}
                    className="hidden sm:inline-flex"
                >
                    <Plus className="size-4" aria-hidden="true" />
                    <span className="hidden lg:inline">New Item</span>
                </Button>
            </div>

            {/* Driven rather than self-triggering, so one dialog serves both the menu and the
                button. Outside the flex row: they portal to the body, but a `hidden sm:inline-flex`
                ancestor would still be the wrong home for them. */}
            <CreateCollectionDialog open={newCollectionOpen} onOpenChange={setNewCollectionOpen} />
            <CreateItemDialog open={newItemOpen} onOpenChange={setNewItemOpen} />
        </header>
    );
}
