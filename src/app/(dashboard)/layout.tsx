import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { TopBar } from "@/components/layout/TopBar";
import { getSidebarData } from "@/server/mock-data/queries";

export default async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const sidebarData = await getSidebarData();

    return (
        <SidebarProvider>
            <div className="flex h-screen flex-col">
                <TopBar />
                <div className="flex min-h-0 flex-1">
                    <Sidebar data={sidebarData} />
                    <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
                </div>
            </div>
        </SidebarProvider>
    );
}
