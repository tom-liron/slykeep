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

    // Three tracks, not a row of siblings: the outer groups and the search are all `flex-1`, so the
    // two sides take an equal share whatever they contain — and once the search hits its own
    // `max-w`, the space it gives back is split evenly between them. That is what puts the field on
    // the middle of the page rather than wherever the brand and the toggles happen to end.
    return (
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-3 sm:gap-3 sm:px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
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

                <Brand href="/" />

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

            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                {/* `aria-label` as well as `title`: the tooltip is for a pointer, and the star on its
                    own says nothing to a screen reader. Both, like the two toggles above. */}
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
