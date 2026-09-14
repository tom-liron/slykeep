import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Browser-window frame for showing the real app on the landing page.
 *
 * `Hero` plays its walkthrough inside it: window controls and an address bar above a 16:10 screen,
 * the shape of the laptop viewport the clip is recorded at (`DEVICE_SCREENSHOTS.laptop` in
 * `config/marketing-media.ts`).
 */
export function BrowserFrame({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                "overflow-hidden rounded-xl border border-border bg-card shadow-[0_50px_100px_-50px_rgba(0,0,0,1)]",
                className,
            )}
        >
            <div
                aria-hidden="true"
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border px-4 py-2.5 max-[680px]:px-3 max-[680px]:py-2"
            >
                <div className="flex gap-1.5">
                    <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                    <span className="size-2.5 rounded-full bg-[#febc2e]" />
                    <span className="size-2.5 rounded-full bg-[#28c840]" />
                </div>
                <span className="w-[min(22rem,40vw)] truncate rounded-md bg-background px-3 py-1 text-center text-xs text-zinc-400">
                    slykeep.com
                </span>
            </div>
            <div className="aspect-[16/10] bg-background">{children}</div>
        </div>
    );
}
