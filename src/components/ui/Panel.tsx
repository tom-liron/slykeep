import { cn } from "@/lib/utils";

/**
 * A titled group of related content, rendered as one bordered surface.
 *
 * The settings and profile pages were both a stack of independent cards, each with its own border
 * and its own heading floating above it — which reads as unrelated widgets that happen to share a
 * page. One panel per subject, with the content divided inside it, is what an account page
 * conventionally looks like, and it gives both pages somewhere to add a subject later without
 * becoming a column of loose boxes.
 *
 * Lives in `ui/` rather than `settings/` because both pages render it. What goes *inside* is each
 * page's own: `PanelRow` is the settings shape (a label and a control), and the profile page passes
 * bands of its own instead.
 *
 * The title sits *inside* the border, as the panel's first band, rather than floating above it —
 * a heading outside the surface it names belongs to the page, and this one belongs to the panel. It
 * is separated by the same divider the rows use, so the card reads top to bottom as one object.
 *
 * The heading is `h2` and the rows inside are `h3`, so the structure a screen reader announces is
 * the structure the borders draw.
 */
export function Panel({
    id,
    title,
    description,
    children,
}: {
    id: string;
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        // `overflow-hidden` so the last row's tint is clipped by the rounded corner rather than
        // squaring it off. `divide-y` falls between the header band and the first row too, since
        // both are direct children — one rule, no separator declared per row.
        <section
            aria-labelledby={`${id}-heading`}
            className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
        >
            {/* Tighter vertically than a row: the same padding would make the title read as another
                setting rather than as the label on the group. */}
            <div className="px-6 py-4">
                <h2 id={`${id}-heading`} className="font-semibold">
                    {title}
                </h2>
                {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>

            {children}
        </section>
    );
}

/**
 * One setting: what it is, what it does, and the control that does it.
 *
 * The control sits at the end of the row rather than under the copy, which lines every action in a
 * panel up on the same edge — the thing that makes a settings page scannable is that the buttons are
 * always in the same place. Below `sm` it stacks, since a sentence sharing a narrow row with a
 * button wraps to a few words per line.
 *
 * `tone="destructive"` replaces the red border the delete card used to carry on its own. Inside a
 * shared panel there is no separate border left to tint, so the warning moves to the row's surface —
 * still the design language naming the action and letting colour carry the weight, rather than a
 * "Danger zone" heading (see project-overview.md §8 — Notion, Linear, Raycast).
 */
export function PanelRow({
    title,
    description,
    tone = "default",
    children,
}: {
    title: string;
    description: string;
    tone?: "default" | "destructive";
    children?: React.ReactNode;
}) {
    return (
        <div
            className={cn(
                "flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
                tone === "destructive" && "bg-destructive/5",
            )}
        >
            <div className="space-y-1">
                <h3 className="text-sm font-medium">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>

            {children}
        </div>
    );
}
