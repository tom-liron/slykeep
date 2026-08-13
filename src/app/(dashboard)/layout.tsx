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
                {/* h-full fills the body; h-screen (100vh) would overshoot the visible viewport on
                    mobile, where browser chrome is excluded from vh. */}
                <div className="flex h-full flex-col">
                    <TopBar searchData={searchData} />
                    <div className="flex min-h-0 flex-1">
                        <Sidebar data={sidebarData} />
                        {/* `p-4` narrow: 24px each side is 48px of a 390px screen spent on margin,
                            which every list and card inside then does without. */}
                        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
                            {children}
                        </main>
                    </div>
                </div>
            </EditorPreferencesProvider>
        </SidebarProvider>
    );
}
