"use client";

import { Menu, PanelLeft, Search } from "lucide-react";

import { CreateCollectionDialog } from "@/components/collections/CreateCollectionDialog";
import { CreateItemDialog } from "@/components/items/CreateItemDialog";
import { Brand } from "@/components/layout/Brand";
import { useSidebar } from "@/components/layout/SidebarContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TopBar() {
    const { toggleCollapsed, toggleMobile } = useSidebar();

    return (
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-3 sm:gap-3 sm:px-4">
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

            <div className="relative ml-1 min-w-0 flex-1 sm:ml-2 sm:max-w-md">
                <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                />
                <Input
                    type="search"
                    placeholder="Search coming soon"
                    className="pl-9 pr-14"
                    aria-label="Search coming soon"
                    disabled
                />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
                <CreateCollectionDialog />
                <CreateItemDialog />
            </div>
        </header>
    );
}
