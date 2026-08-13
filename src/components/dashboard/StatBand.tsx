import type { LucideIcon } from "lucide-react";

import { cn, withAlpha } from "@/lib/utils";

/**
 * The dashboard's summary numbers: four cards on a desktop, one divided band on a phone.
 *
 * Cards are the right shape when there is room for four of them across. They were the wrong shape
 * stacked, because `StatCard` wore the same `rounded-xl border border-border bg-card` surface as
 * `CollectionCard`, which is a link — so a phone opened on four things that looked exactly like the
 * clickable things below them, did nothing, and filled the screen before the first real one. Four
 * across, side by side with the collections grid, that reads as a summary row; one under another it
 * reads as a list of dead buttons.
 *
 * Linking them instead was the other way out and does not work: Collections and both Favorites have
 * destinations, and Items has none, since there is no all-items route, only `/items/[slug]` per
 * type. Three live cards and one dead one is worse than four honest numbers.
 *
 * **The widths are the window's, sized for the worst case, and this was a container query first.**
 * Container queries are the more accurate tool and they are the wrong one here. What constrains the
 * grid is its own width, so `@container` measured that — correctly — and the shape then followed the
 * space it actually had. The trouble is that this page's space does not grow with the window:
 * `Sidebar` is `hidden md:block w-64`, so at 768px a 256px rail appears and the content area is
 * ~319px *narrower* at 768 than at 767. Reacting honestly to that produced a layout that went band,
 * cards, band again, cards again on the way up, which is unreadable as a rule even though every step
 * was locally right.
 *
 * So the question changed from "does it fit right now" to "does it fit with the rail open", which
 * has one answer per window width. 848 and 1184 are the two content widths below — 520 and 860 —
 * plus the 319px the sidebar and the page padding take when it is showing. Toggling the rail now
 * changes how roomy the summary looks and never what shape it is.
 *
 * The content widths come from the longest label rather than from the scale: 520px is where two band
 * cells still hold "Favorite Collections" on one line, 860px is where four cards do. Change the
 * labels and all four numbers change with them.
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
                "grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border min-[848px]:grid-cols-2",
                // Desktop: the band's own chrome is dropped and each cell becomes a card again.
                //
                // 1184 = 860 + 319. A card needs the label's 127px, its 8px gap, its 32px icon and
                // 32px of padding — 199px — so four with three 16px gutters need 844; it is 860
                // because 844 exactly put each card on 199.25px and the label wrapped there on
                // sub-pixel rounding. 848 = 520 + 319 the same way, a band cell wanting ~259px
                // because the number shares the label's line.
                //
                // Arbitrary rather than off the scale: the nearest named stop above 1184 is `xl`
                // at 1280, and ~100px of laptop in the wrong shape is exactly the bug this already
                // shipped once.
                "min-[1184px]:grid-cols-4 min-[1184px]:gap-4 min-[1184px]:overflow-visible min-[1184px]:rounded-none min-[1184px]:border-0 min-[1184px]:bg-transparent",
                className,
            )}
        >
            {children}
        </dl>
    );
}

/**
 * One stat, in both shapes.
 *
 * Two layouts out of one DOM, placed explicitly on a two-column grid rather than rendered twice and
 * toggled with `hidden`: a second copy would read every number twice to a screen reader, and
 * `aria-hidden` on half of it is a workaround for a problem that does not need to exist.
 *
 * - Band, one column: the icon on the left spanning both rows, the label above the number beside it.
 * - Band, two columns: the number moves to the right edge. A cell here can be 400px wide while its
 *   contents need 100, and stacking them at the left leaves the void that made the wide band look
 *   broken in the first place. Spread, it reads as a row.
 * - Card: the label and the icon share the top row, the number sits underneath — the original
 *   `StatCard` layout, unchanged.
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
        // One shape per display mode, rather than one grid placed two ways. Placing both states on
        // a single grid gave every rule a counterpart at the other breakpoint, and while these were
        // container variants Tailwind did not order them the way the class list reads — the narrower
        // stop won and rendered the desktop card upside down, number above label. Flex for the band
        // and grid for the card share no properties, so there is nothing left to win a fight:
        // `flex-1` and `shrink-0` are inert once the box is a grid, the placements are inert while
        // it is a flex row, and every rule here overrides an unvariant base rather than another
        // variant. Worth keeping even now the variants are ordinary media queries.
        <div
            className={cn(
                // Band: a row. The number sits at the right edge, which is what keeps a 400px cell
                // from being a small block of ink with a void beside it.
                "flex items-center gap-3 bg-card p-4",
                // Card: label and icon on the top row, number underneath — the original layout.
                "min-[1184px]:grid min-[1184px]:h-full min-[1184px]:grid-cols-[1fr_auto] min-[1184px]:items-start min-[1184px]:gap-2 min-[1184px]:rounded-xl min-[1184px]:border min-[1184px]:border-border",
            )}
        >
            <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg min-[1184px]:col-start-2 min-[1184px]:row-start-1 min-[1184px]:size-8"
                style={{ backgroundColor: withAlpha(color), color }}
            >
                <Icon className="size-4" aria-hidden="true" />
            </span>

            {/* `min-w-0` so the label may shrink, `break-words` as the floor under one too long for
                its cell — which the band's breakpoints should keep out of reach. */}
            <dt className="min-w-0 flex-1 text-sm break-words text-muted-foreground min-[1184px]:col-start-1 min-[1184px]:row-start-1">
                {label}
            </dt>
            <dd className="shrink-0 text-2xl font-semibold min-[1184px]:col-start-1 min-[1184px]:row-start-2 min-[1184px]:mt-2">
                {value}
            </dd>
        </div>
    );
}
