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

/**
 * The dashboard's top bar: sidebar toggles, the {@link Brand} lockup, the ⌘K search field, and the
 * Upgrade / Favorites / create actions.
 *
 * Rendered once in the dashboard layout. It owns the create dialogs' open state and renders
 * {@link CreateItemDialog} / {@link CreateCollectionDialog} controlled, because below `sm` the two
 * triggers collapse into one `DropdownMenu` and a menu item cannot also be a dialog trigger.
 *
 * @remarks
 * From `sm` up the two outer groups and the search are each `flex-1`, so the field sits centred.
 * Neither outer group carries `min-w-0` — with it, `flex-1`'s `flex: 1 1 0%` would shrink the
 * track under its `shrink-0` buttons and push them over the search. The search *is* `min-w-0`: it
 * has a placeholder it can clip.
 */
export function TopBar({
    searchData,
    isPro,
}: {
    searchData: SearchDataViewModel;
    /** Free accounts get an Upgrade control; a subscriber has nothing to upgrade to. */
    isPro: boolean;
}) {
    const { toggleCollapsed, toggleMobile } = useSidebar();

    // The bar owns the create dialogs' triggers because below `sm` the two are one menu, and a menu
    // item cannot also be a dialog trigger.
    const [newItemOpen, setNewItemOpen] = useState(false);
    const [newCollectionOpen, setNewCollectionOpen] = useState(false);

    return (
        // `sticky` below `md`, `static` from `md` up where the bar is already in a pinned frame.
        // `bg-sidebar`: the bar and the sidebar are one near-black frame around the work area, and
        // the opaque fill keeps content from showing through while the bar is sticky.
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-3 sm:gap-3 sm:px-4 md:static">
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

                {/* `compact`: the mark alone below `sm`, where the wordmark has nothing to do. */}
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

            {/* Renders the search field and the palette behind it. */}
            <CommandPalette data={searchData} />

            {/* `shrink-0` narrow, a third of the bar from `sm` up, and no `min-w-0` — see the
                header note. */}
            <div className="flex shrink-0 items-center justify-end gap-2 sm:flex-1">
                {/* Ghost and first in the group, so it stays clear of the two create buttons.
                    `hidden sm:inline-flex` because a phone has no room for a seventh target here;
                    a free account reaches checkout from Settings or a Pro item type instead. */}
                {!isPro && (
                    <Button
                        variant="ghost"
                        asChild
                        // The brand gold, the colour of every call to action in the app. `Zap`, not
                        // a sparkle: sparkles mean AI, and this leads to a price list.
                        className="hidden shrink-0 gap-1.5 text-primary hover:bg-primary/15 hover:text-primary sm:inline-flex"
                    >
                        <Link href="/upgrade">
                            <Zap className="size-4" aria-hidden="true" />
                            Upgrade
                        </Link>
                    </Button>
                )}

                {/* `aria-label` as well as `title`: the tooltip is for a pointer, the star says
                    nothing to a screen reader. Shown at every width — `SidebarNav` also carries
                    Favorites, but there is room here, and on a phone the nav is behind the
                    hamburger. */}
                <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    aria-label="Favorites"
                    title="Favorites"
                    // Full `muted` on hover, not the ghost variant's `muted/50`, which is nearly
                    // the background here. `hover:text-foreground` comes off with it — the star
                    // sets its own colour.
                    className="hover:bg-muted dark:hover:bg-muted"
                >
                    <Link href="/favorites">
                        {/* `--favorite` at full strength, the same colour and outline as every
                            other star in the app, and matching the sidebar's Favorites row so one
                            destination is not two yellows. Hover lifts brightness rather than
                            changing the colour — a second yellow would be a second meaning — and
                            `brightness` leaves the token alone, so this survives a retuned
                            `--favorite` and the light theme. `105` is the smallest step: there is
                            little headroom above an already-light colour before the lift reads as
                            a colour change, and the button's `hover:bg-muted` carries the louder
                            half of the hover signal. */}
                        <Star
                            className="size-5 text-favorite transition group-hover/button:brightness-105"
                            aria-hidden="true"
                        />
                    </Link>
                </Button>

                {/* Separates navigation (Upgrade, Favorites) from the two create actions. */}
                <span
                    aria-hidden="true"
                    className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block"
                />
                {/* Below `sm`, one create menu instead of two buttons — a phone has no room for
                    both 44px targets. From `sm` up both buttons return, labels appearing at `lg`. */}
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
                    {/* Label at `lg`: the labelled pair only fits alongside the brand, search
                        field and star from about 900px. */}
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

            {/* Controlled, so one dialog serves both the menu and the button. Outside the flex row,
                since a `hidden sm:inline-flex` ancestor would be the wrong home even though they
                portal to the body. */}
            <CreateCollectionDialog open={newCollectionOpen} onOpenChange={setNewCollectionOpen} />
            <CreateItemDialog open={newItemOpen} onOpenChange={setNewItemOpen} />
        </header>
    );
}
