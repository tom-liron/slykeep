import { cn } from "@/lib/utils";

/**
 * A titled group of related content, rendered as one bordered surface — the section container for
 * the settings and profile pages.
 *
 * One panel per subject, with its content divided inside it by the same divider, so a page reads as
 * a few labelled groups rather than a column of loose cards. Lives in `ui/` because both pages
 * render it. What goes *inside* is each page's own: {@link PanelRow} is the settings shape (a label
 * and a control), and the profile page passes bands of its own.
 *
 * @remarks
 * The title is the panel's first band, inside the border, so the heading belongs to the panel
 * rather than to the page. The heading is `h2` and {@link PanelRow}'s titles are `h3`, so the
 * structure a screen reader announces matches the one the borders draw.
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
 * One row inside a {@link Panel}: what a setting is, what it does, and the control that does it.
 *
 * The control sits at the end of the row so every action in a panel lines up on the same edge,
 * which is what makes a settings page scannable. Below `sm` it stacks, since a sentence and a
 * button sharing a narrow row wrap badly.
 *
 * `tone="destructive"` tints the row surface for a dangerous action (delete account). Colour
 * carries the weight rather than a "Danger zone" heading — see `project-overview.md` §8 (Notion,
 * Linear, Raycast).
 */
export function PanelRow({
    title,
    description,
    tone = "default",
    children,
}: {
    /**
     * Usually a string. Widened to a node for the billing row, whose heading carries the plan badge
     * beside its text — the badge belongs *in* the heading rather than out at the control edge,
     * where it would read as something to click.
     */
    title: React.ReactNode;
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
