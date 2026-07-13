import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { TopBar } from "@/components/layout/TopBar";

/**
 * Dashboard shell: a full-width top bar (with the brand) across the top, then a
 * collapsible sidebar on the left and scrollable main on the right. The sidebar
 * becomes a slide-out drawer on mobile.
 */
export default function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <SidebarProvider>
            <div className="flex h-screen flex-col">
                <TopBar />
                <div className="flex min-h-0 flex-1">
                    <Sidebar />
                    <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
                </div>
            </div>
        </SidebarProvider>
    );
}
