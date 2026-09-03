"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SidebarViewModel } from "@/types/view-models";
import { Brand } from "./Brand";
import { useSidebar } from "./SidebarContext";
import { SidebarNav } from "./SidebarNav";

/**
 * The dashboard's left navigation, in its two forms: a collapsible desktop rail and a mobile drawer.
 *
 * Rendered once in the dashboard layout. Both forms host the same {@link SidebarNav}; which shows
 * is width-driven (`md`) plus the toggle state from {@link useSidebar}. The `SidebarViewModel` — item
 * types, favourite and recent collections — is built server-side and passed in.
 */
export function Sidebar({ data }: { data: SidebarViewModel }) {
    const { collapsed, mobileOpen, setMobileOpen } = useSidebar();

    return (
        <>
            <aside
                className={cn(
                    "hidden shrink-0 overflow-hidden border-r border-border bg-sidebar transition-[width] duration-200 ease-in-out md:block",
                    // Three states. `null` defers to the width — closed below `lg`, open from `lg`
                    // — expressed in CSS so the first paint is right without an effect. The rail is
                    // mounted from `md` so no width loses the persistent toggle, and shut below
                    // `lg` because a rail is a quarter of a 900px window.
                    //
                    // `invisible`, not `w-0` + `overflow-hidden`: a zero-width clipped box still
                    // holds its links in the tab order and reads them to a screen reader.
                    // `visibility` removes them from both and animates as discretely as the width.
                    collapsed === null
                        ? "invisible w-0 border-r-0 lg:visible lg:w-64 lg:border-r"
                        : collapsed
                          ? "invisible w-0 border-r-0"
                          : "w-64",
                )}
            >
                <div className="h-full w-64">
                    <SidebarNav data={data} />
                </div>
            </aside>

            <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 md:hidden" />
                    <Dialog.Content
                        className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80%] flex-col border-r border-border bg-sidebar shadow-xl focus:outline-none md:hidden"
                        onCloseAutoFocus={(event) => {
                            event.preventDefault();
                            document.querySelector<HTMLElement>("#mobile-menu-button")?.focus();
                        }}
                        // A delegated handler: any link in the drawer closes it, as a floor under
                        // the `onNavigate` prop threaded through `SidebarNav` to every row.
                        // `onNavigate` still fires first; this catches whatever forgets to call it.
                        onClick={(event) => {
                            if ((event.target as HTMLElement).closest("a[href]")) {
                                setMobileOpen(false);
                            }
                        }}
                    >
                        <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                        <Dialog.Description className="sr-only">
                            Browse item types and collections.
                        </Dialog.Description>
                        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
                            <Brand href="/" onNavigate={() => setMobileOpen(false)} />
                            <Dialog.Close asChild>
                                <Button variant="ghost" size="icon" aria-label="Close menu">
                                    <X className="size-5" aria-hidden="true" />
                                </Button>
                            </Dialog.Close>
                        </div>
                        <div className="min-h-0 flex-1">
                            <SidebarNav data={data} onNavigate={() => setMobileOpen(false)} />
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    );
}
