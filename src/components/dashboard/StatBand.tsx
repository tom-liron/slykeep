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
 * **The widths are this element's own, via `@container/app`.** They were the window's for one
 * release, sized for the worst case, and that is worth recording because it looked like the safe
 * choice and was not. The reasoning ran: `Sidebar` was `hidden md:block w-64`, so a 256px rail
 * appeared at 768px and the content area was ~319px *narrower* at 768 than at 767; a container query
 * reported that honestly and the shape went band, cards, band, cards on the way up, which is
 * unreadable as a rule even though every step was locally right. So the question was changed from
 * "does it fit right now" to "does it fit with the rail open" — one answer per window width, 848 and
 * 1184 being the content widths below plus the 319px the rail and the padding take.
 *
 * That traded a discontinuity nobody meets outside a resize handle for two costs everybody pays.
 * Four cards were held back to 1184px although they fit at 865, so every laptop between the two ran
 * the phone layout. And the rail's collapse toggle stopped meaning anything: it hands the page 256px,
 * the window does not move, so no worst-case rule can notice, and the summary sat in the narrow shape
 * with a third of the row empty.
 *
 * The discontinuity was the shell's to fix, and it was — the rail now defaults to collapsed below
 * `xl`, so content width no longer falls as the window grows (see `Sidebar`). With that gone the
 * accurate tool is also the safe one, and these are plain "how much room do I have" stops again.
 *
 * 520 and 860 come from the longest label rather than from any scale. A card needs the label's 127px,
 * its 8px gap, its 32px icon and 32px of padding — 199px — so four with three 16px gutters need 844;
 * it is 860 because 844 put each card on exactly 199.25px and the label wrapped there on sub-pixel
 * rounding. 520 is the same sum for two band cells, each wanting ~259px because the number shares the
 * label's line. Change the labels and both numbers change with them.
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
                // Roomy: the band's own chrome is dropped and each cell becomes a card again.
                //
                // Arbitrary stops on both, deliberately, and never one arbitrary beside one named.
                // Tailwind emits an arbitrary container variant ahead of a named one whatever order
                // the class list is written in, so `@min-[860px]` lost to `@md` and this rendered
                // half of each layout — the desktop card upside down, number above label. Two
                // arbitrary stops sort against each other correctly. That is the whole rule.
                "@min-[860px]/app:grid-cols-4 @min-[860px]/app:gap-4 @min-[860px]/app:overflow-visible @min-[860px]/app:rounded-none @min-[860px]/app:border-0 @min-[860px]/app:bg-transparent",
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
        // a single grid gave every rule a counterpart at the other stop, and Tailwind did not order
        // them the way the class list reads — the narrower stop won and rendered the card upside
        // down, number above label. Flex for the band and grid for the card share no properties, so
        // there is nothing left to win a fight: `flex-1` and `shrink-0` are inert once the box is a
        // grid, the placements are inert while it is a flex row, and every rule here overrides an
        // unvariant base rather than another variant. That is what makes the ordering irrelevant
        // rather than merely currently-correct, which matters again now these are container
        // variants — the shape that exposed the ordering bug in the first place.
        <div
            className={cn(
                // Band: a row. The number sits at the right edge, which is what keeps a 400px cell
                // from being a small block of ink with a void beside it.
                "flex items-center gap-3 bg-card p-4",
                // Card: label and icon on the top row, number underneath — the original layout.
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
