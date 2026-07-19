import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { TopBar } from "@/components/layout/TopBar";
import { getSidebarCollections } from "@/server/collections";
import { getSidebarNav } from "@/server/item-types";

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
    const [nav, collections] = await Promise.all([getSidebarNav(), getSidebarCollections()]);
    const sidebarData = { ...nav, ...collections };

    return (
        <SidebarProvider>
            {/* h-full fills the body; h-screen (100vh) would overshoot the visible viewport on
                mobile, where browser chrome is excluded from vh. */}
            <div className="flex h-full flex-col">
                <TopBar />
                <div className="flex min-h-0 flex-1">
                    <Sidebar data={sidebarData} />
                    <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
                </div>
            </div>
        </SidebarProvider>
    );
}
