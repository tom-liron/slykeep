"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Brand } from "./Brand";
import { useSidebar } from "./sidebar-context";
import { SidebarNav } from "./SidebarNav";

/**
 * Renders the app sidebar in two forms:
 * - Desktop (>= md): a fixed rail that collapses to zero width when toggled.
 * - Mobile (< md): a slide-out drawer over a dimmed backdrop.
 */
export function Sidebar() {
    const { collapsed, mobileOpen, setMobileOpen } = useSidebar();

    // While the mobile drawer is open, close it on Escape and lock body scroll.
    useEffect(() => {
        if (!mobileOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMobileOpen(false);
        };
        document.addEventListener("keydown", onKeyDown);

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [mobileOpen, setMobileOpen]);

    return (
        <>
            {/* Desktop rail */}
            <aside
                className={cn(
                    "hidden shrink-0 overflow-hidden border-r border-border bg-sidebar transition-[width] duration-200 ease-in-out md:block",
                    collapsed ? "w-0 border-r-0" : "w-64",
                )}
            >
                <div className="h-full w-64">
                    <SidebarNav />
                </div>
            </aside>

            {/* Mobile drawer */}
            <div
                className={cn(
                    "fixed inset-0 z-50 md:hidden",
                    mobileOpen ? "pointer-events-auto" : "pointer-events-none",
                )}
                aria-hidden={!mobileOpen}
            >
                {/* Backdrop */}
                <button
                    type="button"
                    aria-label="Close sidebar"
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                        "absolute inset-0 bg-black/50 transition-opacity duration-200",
                        mobileOpen ? "opacity-100" : "opacity-0",
                    )}
                />
                {/* Panel */}
                <div
                    className={cn(
                        "absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col border-r border-border bg-sidebar shadow-xl transition-transform duration-200 ease-in-out",
                        mobileOpen ? "translate-x-0" : "-translate-x-full",
                    )}
                >
                    <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
                        <Brand />
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Close menu"
                            onClick={() => setMobileOpen(false)}
                        >
                            <X className="size-5" />
                        </Button>
                    </div>
                    <div className="min-h-0 flex-1">
                        <SidebarNav onNavigate={() => setMobileOpen(false)} />
                    </div>
                </div>
            </div>
        </>
    );
}
