"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SidebarViewModel } from "@/types/view-models";
import { Brand } from "./Brand";
import { useSidebar } from "./SidebarContext";
import { SidebarNav } from "./SidebarNav";

export function Sidebar({ data }: { data: SidebarViewModel }) {
    const { collapsed, mobileOpen, setMobileOpen } = useSidebar();

    return (
        <>
            <aside
                className={cn(
                    "hidden shrink-0 overflow-hidden border-r border-border bg-sidebar transition-[width] duration-200 ease-in-out md:block",
                    collapsed ? "w-0 border-r-0" : "w-64",
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
                        // Any link in the drawer closes it, whether or not it remembered to call
                        // `onNavigate`. That prop is threaded through `SidebarNav` to every row and
                        // is still what fires first — this is the floor under it, and it exists
                        // because the account menu at the foot of the drawer did forget, so Profile
                        // and Settings opened underneath a drawer that stayed put. One delegated
                        // handler cannot be forgotten by whatever gets added to the nav next.
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
