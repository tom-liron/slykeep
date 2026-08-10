import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { TopBar } from "@/components/layout/TopBar";
import { getSidebarCollections } from "@/server/collections";
import { getSidebarNav } from "@/server/item-types";
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
    const [nav, collections, searchData] = await Promise.all([
        getSidebarNav(),
        getSidebarCollections(),
        getSearchData(),
    ]);
    const sidebarData = { ...nav, ...collections };

    return (
        <SidebarProvider>
            {/* h-full fills the body; h-screen (100vh) would overshoot the visible viewport on
                mobile, where browser chrome is excluded from vh. */}
            <div className="flex h-full flex-col">
                <TopBar searchData={searchData} />
                <div className="flex min-h-0 flex-1">
                    <Sidebar data={sidebarData} />
                    <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
                </div>
            </div>
        </SidebarProvider>
    );
}
