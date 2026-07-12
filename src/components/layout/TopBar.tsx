"use client";

import { FolderPlus, Menu, PanelLeft, Plus, Search } from "lucide-react";

import { Brand } from "@/components/layout/Brand";
import { useSidebar } from "@/components/layout/sidebar-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Full-width dashboard top bar. Holds the brand (always visible), a mobile
 * hamburger that opens the sidebar drawer, and a desktop toggle that collapses
 * the rail. Search and action buttons are placeholders for a later phase.
 *
 * JSX order is chosen so each breakpoint reads naturally: mobile shows
 * [hamburger][brand] (desktop toggle hidden); desktop shows [brand][collapse]
 * (hamburger hidden).
 */
export function TopBar() {
  const { toggleCollapsed, toggleMobile } = useSidebar();

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-3 sm:gap-3 sm:px-4">
      {/* Mobile: hamburger opens the drawer */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open menu"
        onClick={toggleMobile}
        className="shrink-0 md:hidden"
      >
        <Menu className="size-5" />
      </Button>

      <Brand />

      {/* Desktop: collapse/expand the rail */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle sidebar"
        onClick={toggleCollapsed}
        className="hidden shrink-0 md:inline-flex"
      >
        <PanelLeft className="size-5" />
      </Button>

      <div className="relative ml-1 min-w-0 flex-1 sm:ml-2 sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search items..."
          className="pl-9 pr-14"
          aria-label="Search items"
          readOnly
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
          ⌘ K
        </kbd>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button variant="outline" aria-label="New Collection">
          <FolderPlus className="size-4" />
          <span className="hidden lg:inline">New Collection</span>
        </Button>
        <Button aria-label="New Item">
          <Plus className="size-4" />
          <span className="hidden lg:inline">New Item</span>
        </Button>
      </div>
    </header>
  );
}
