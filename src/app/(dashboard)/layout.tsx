import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { TopBar } from "@/components/layout/TopBar";
import { EditorPreferencesProvider } from "@/components/settings/EditorPreferencesProvider";
import { getSidebarCollections } from "@/server/collections";
import { getSidebarNav } from "@/server/item-types";
import { getEditorPreferences } from "@/server/profile";
import { getSearchData } from "@/server/search";

/**
 * Every route under this layout reads per-user, mutable data. Without this, Next prerenders the
 * dashboard and /collections at build time and bakes the rows into the HTML. Auth will force this
 * anyway once the session is read from cookies, but it is not in place yet.
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
                        {/* The container everything inside measures itself against.
                            `container-type: inline-size` makes this the query container, so a
                            component asks "how much room do I have" instead of asking the viewport
                            how wide it is and subtracting a guessed sidebar. Named `app` so a
                            component states which box it meant; an anonymous container would silently
                            re-target if anything between here and the component ever declared one.

                            An inline-size query measures the *content* box, so the padding below is
                            already excluded from every stop written against it — `@min-[860px]/app`
                            means 860px to lay out in, not 860px minus whatever the chrome takes.

                            `p-4` narrow: 24px each side is 48px of a 390px screen spent on margin,
                            which every list and card inside then does without.

                            `overflow-y-auto` only from `md`, where this is a pane inside a pinned
                            frame. Below that the document scrolls and a second scroller here would
                            trap the page inside a box the size of the screen. */}
                        <main className="@container/app min-w-0 flex-1 p-4 sm:p-6 md:overflow-y-auto">
                            {children}
                        </main>
                    </div>
                </div>
            </EditorPreferencesProvider>
        </SidebarProvider>
    );
}
