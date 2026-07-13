import type { LucideIcon } from "lucide-react";

import { withAlpha } from "@/lib/utils";

/** A single summary stat: label, big number, and a tinted type-colored icon. */
export function StatCard({
    label,
    value,
    icon: Icon,
    color,
}: {
    label: string;
    value: number;
    icon: LucideIcon;
    color: string;
}) {
    return (
        <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm text-muted-foreground">{label}</p>
                <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: withAlpha(color), color }}
                >
                    <Icon className="size-4" aria-hidden="true" />
                </span>
            </div>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
    );
}
