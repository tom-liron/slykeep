import type { LucideIcon } from "lucide-react";

import { cn, withAlpha } from "@/lib/utils";

/**
 * The layout container for the dashboard's four summary numbers: a divided band below 860px of
 * content width, four separate cards above it.
 *
 * Renders on the dashboard overview around four {@link Stat} children. A band rather than four
 * stacked cards on a phone, so the summary does not read as a column of dead buttons beside the
 * clickable `CollectionCard`s below it. The numbers are not links — Items has no all-items route,
 * only `/items/[slug]` per type — so all four stay plain text.
 *
 * @remarks
 * The breakpoints are container queries on `@container/app`, so they follow this region's width.
 * In its default state, the sidebar is closed below `lg` and consumes 16rem from `lg` up; the
 * container query follows the content-width drop at that transition.
 *
 * `520` and `860` come from the longest label: a card needs ~199px (label 127px + gap + 32px icon
 * + 32px padding), so four with three 16px gutters need `860`; `520` is the same sum for two band
 * cells. Change the labels and both change.
 */
export function StatBand({
    className,
    children,
}: {
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <dl
            aria-label="Summary"
            className={cn(
                // Phone and tablet: one joined band. The hairlines are `gap-px` over a `bg-border`
                // container rather than `divide-x`/`divide-y`, which border every child after the
                // first — right in a single row, and a rule down the left edge of the second the
                // moment the grid wraps.
                "grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border @min-[520px]/app:grid-cols-2",
                // At 860px the band chrome is dropped and each cell becomes a card. Both stops are
                // arbitrary `@min-[…]` variants, never one arbitrary beside one named: Tailwind
                // emits an arbitrary container variant ahead of a named one regardless of class
                // order, so `@min-[860px]` would lose to `@md`. Two arbitrary stops sort correctly.
                "@min-[860px]/app:grid-cols-4 @min-[860px]/app:gap-4 @min-[860px]/app:overflow-visible @min-[860px]/app:rounded-none @min-[860px]/app:border-0 @min-[860px]/app:bg-transparent",
                className,
            )}
        >
            {children}
        </dl>
    );
}

/**
 * One stat — label, value, icon — in whichever of {@link StatBand}'s shapes is active.
 *
 * One DOM, three CSS layouts, so a screen reader reads each number once:
 * - Band, one column: icon on the left spanning both rows, label above the number.
 * - Band, two columns: the number moves to the right edge, so a wide cell reads as a row rather
 *   than a block of ink with a void beside it.
 * - Card (from 860px): label and icon on the top row, number underneath.
 */
export function Stat({
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
        // Flex for the band, grid for the card — two display models that share no properties, so
        // the Tailwind class-ordering that decides which container variant wins cannot render a
        // half-and-half layout. `flex-1` / `shrink-0` are inert once the box is a grid, the grid
        // placements are inert while it is a flex row, and every rule overrides an unvariant base
        // rather than another variant.
        <div
            className={cn(
                // Band: a row, the number at the right edge.
                "flex items-center gap-3 bg-card p-4",
                // Card: label and icon on the top row, number underneath.
                "@min-[860px]/app:grid @min-[860px]/app:h-full @min-[860px]/app:grid-cols-[1fr_auto] @min-[860px]/app:items-start @min-[860px]/app:gap-2 @min-[860px]/app:rounded-xl @min-[860px]/app:border @min-[860px]/app:border-border",
            )}
        >
            <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg @min-[860px]/app:col-start-2 @min-[860px]/app:row-start-1 @min-[860px]/app:size-8"
                style={{ backgroundColor: withAlpha(color), color }}
            >
                <Icon className="size-4" aria-hidden="true" />
            </span>

            {/* `min-w-0` so the label may shrink, `break-words` as the floor under one too long for
                its cell — which the band's stops should keep out of reach. */}
            <dt className="min-w-0 flex-1 text-sm break-words text-muted-foreground @min-[860px]/app:col-start-1 @min-[860px]/app:row-start-1">
                {label}
            </dt>
            <dd className="shrink-0 text-2xl font-semibold @min-[860px]/app:col-start-1 @min-[860px]/app:row-start-2 @min-[860px]/app:mt-2">
                {value}
            </dd>
        </div>
    );
}
