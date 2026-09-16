import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * The shadcn/ui button primitive: {@link Button}, plus {@link buttonVariants} for composing the
 * same styling onto links and other elements.
 *
 * The base interactive control across the app. `asChild` renders the classes onto a caller's
 * element via Radix `Slot` — `Pagination` and several nav links use {@link buttonVariants}
 * directly for that reason.
 */

/**
 * The class-variance-authority definition behind {@link Button}, keyed by `variant` and `size`.
 *
 * @remarks
 * Every `size` carries a `pointer-coarse:` floor of 44px (Apple 44pt, Material 48dp, WCAG 2.2
 * SC 2.5.5); the base sizes are drawn for a mouse. The floor keys off the *pointer*: a touch
 * laptop at 1440px needs it and a mouse at 390px does not, so a width breakpoint would be wrong on
 * both. The box grows to reach the floor rather than an `::after` overhang extending the hit area,
 * because these buttons sit on `gap-2` in the top bar where an overhang would overlap the
 * neighbour.
 */
const buttonVariants = cva(
    // `cursor-pointer` because Tailwind v4's preflight sets `cursor: default` on every `<button>`.
    // Disabled buttons keep the arrow: `disabled:pointer-events-none` stops them resolving a
    // cursor at all.
    "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-glow active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                // The hover lifts the gold rather than fading it. `bg-primary/80` let the
                // near-black background through, so this was the one variant in the set that got
                // *darker* under the pointer while `outline`, `ghost`, `secondary` and
                // `destructive` all brightened. A token rather than an alpha or a `color-mix`,
                // because every way of blending gold toward something colourless takes its chroma
                // with it — see `--primary-hover` in `globals.css` for the numbers.
                default: "bg-primary text-primary-foreground hover:bg-primary-hover",
                outline:
                    "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
                ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
                destructive:
                    "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
                link: "text-primary underline-offset-4 hover:underline",
            },
            // Each size adds its `pointer-coarse:` floor here — see the `buttonVariants` block
            // above for why the floor keys off the pointer and grows the box.
            size: {
                default:
                    "h-8 gap-1.5 px-2.5 pointer-coarse:h-11 pointer-coarse:min-w-11 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
                xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg pointer-coarse:h-11 pointer-coarse:min-w-11 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
                sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg pointer-coarse:h-11 pointer-coarse:min-w-11 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
                lg: "h-9 gap-1.5 px-2.5 pointer-coarse:h-12 pointer-coarse:min-w-12 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
                icon: "size-8 pointer-coarse:size-11",
                "icon-xs":
                    "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg pointer-coarse:size-11 [&_svg:not([class*='size-'])]:size-3",
                "icon-sm":
                    "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg pointer-coarse:size-11",
                "icon-lg": "size-9 pointer-coarse:size-12",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

function Button({
    className,
    variant = "default",
    size = "default",
    asChild = false,
    ...props
}: React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    }) {
    const Comp = asChild ? Slot.Root : "button";

    return (
        <Comp
            data-slot="button"
            data-variant={variant}
            data-size={size}
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
