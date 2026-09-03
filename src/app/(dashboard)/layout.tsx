import { ProProvider } from "@/components/layout/ProContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { TopBar } from "@/components/layout/TopBar";
import { EditorPreferencesProvider } from "@/components/settings/EditorPreferencesProvider";
import { getSidebarCollections } from "@/server/collections";
import { getSidebarNav } from "@/server/item-types";
import { getEditorPreferences } from "@/server/profile";
import { getSearchData } from "@/server/search";

/**
 * The signed-in application shell: top bar, collapsible sidebar, and the scrolling main pane.
 *
 * `src/proxy.ts` has already required a session before any route in this group renders. This layout
 * reads the per-user data the whole shell needs — the sidebar nav and collections, the command
 * palette's prefetch, the editor preferences — once, in parallel, and hands them down through
 * context providers so the client controls scattered across the tree do not each fetch.
 *
 * @remarks
 * `force-dynamic` because every route here reads per-user, mutable data; without it Next would
 * prerender the dashboard and `/collections` at build time and bake the rows into the HTML.
 */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // The palette's data is fetched here, alongside the sidebar's, because search is client-side:
    // it is one read per page view instead of one per keystroke, and it is in hand before the
    // shortcut can be pressed.
    // The editor preferences are read here for the same reason: every editor in the app renders from
    // them — the drawer, the create dialog, the edit form — and they mount all over this tree.
    const [nav, collections, searchData, editorPreferences] = await Promise.all([
        getSidebarNav(),
        getSidebarCollections(),
        getSearchData(),
        getEditorPreferences(),
    ]);
    const sidebarData = { ...nav, ...collections };

    return (
        <SidebarProvider>
            {/* `nav.user.isPro` again, for the controls too far from this layout to be handed a
                prop — see `ProContext`. The bar below still takes one, being one hop away. */}
            <ProProvider isPro={nav.user.isPro}>
                <EditorPreferencesProvider preferences={editorPreferences}>
                    {/* Two shapes. From `md` up this is a frame pinned to the viewport: the bar and the
                    rail hold still and `main` scrolls inside them. Below `md` the frame is dropped
                    and the whole thing is an ordinary page — `min-h-dvh` so it fills the screen, and
                    the document does the scrolling.

                    `dvh` rather than `vh`: `vh` is the *largest* viewport, chrome excluded, so a
                    pinned frame measured in it hangs its last row behind the browser's own bars.
                    `dvh` tracks what is actually visible. */}
                    <div className="flex min-h-dvh flex-col md:h-dvh">
                        {/* `nav.user` is already read for the sidebar, so the bar costs no query of its own. */}
                        <TopBar searchData={searchData} isPro={nav.user.isPro} />
                        <div className="flex min-h-0 flex-1">
                            <Sidebar data={sidebarData} />
                            {/* The named container (`@container/app`) that content inside measures
                            itself against, so a component asks how much room it has rather than
                            guessing a sidebar width off the viewport. The name pins which box —
                            an anonymous container would re-target if anything between here and the
                            component declared one. `overflow-y-auto` only from `md`, where this is a
                            pane in a pinned frame; below that the document scrolls and a second
                            scroller here would trap the page in a screen-sized box. */}
                            <main className="@container/app min-w-0 flex-1 p-4 sm:p-6 md:overflow-y-auto">
                                {children}
                            </main>
                        </div>
                    </div>
                </EditorPreferencesProvider>
            </ProProvider>
        </SidebarProvider>
    );
}
