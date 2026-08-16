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
                    // Three states, not two. `null` is "nobody has said", and it defers to the width:
                    // closed on a tablet or a half-width window, open on a laptop. Expressed here in
                    // CSS rather than measured in an effect, so the first paint is already right and
                    // the server and the client agree on it.
                    //
                    // Why the rail is mounted from `md` but shut until `lg`: it is mounted so no
                    // width loses persistent navigation — the top bar's toggle is one click, at
                    // every width, and there is no hamburger-and-overlay above `md`. It is shut
                    // below `lg` because 256px of a 900px window is a quarter of the page spent on a
                    // rail. `lg` rather than `xl` because a laptop should arrive with its navigation
                    // showing, and a good many laptop windows are not 1280px wide.
                    //
                    // `invisible` rather than relying on `w-0` and `overflow-hidden`: a zero-width
                    // clipped box still holds its links in the tab order and reads them out to a
                    // screen reader. That was survivable while collapsing was a deliberate act; it
                    // is not now that closed is the default on every tablet. `visibility` is the one
                    // property that takes them out of both, and it animates as discretely as the
                    // width does.
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
