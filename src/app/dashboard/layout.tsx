import { Layers } from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";

/**
 * Dashboard shell: fixed sidebar on the left, top bar + scrollable main on the
 * right. Sidebar and main content are placeholders for Phase 1.
 */
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-full min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-4">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <Layers className="size-5" />
          </span>
          <span className="text-lg font-semibold">DevStash</span>
        </div>
        <div className="p-4">
          <h2 className="text-lg font-semibold">Sidebar</h2>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
