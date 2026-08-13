import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    // `cursor-pointer` is here rather than at any call site because Tailwind v4's preflight sets
    // `cursor: default` on every `<button>` — v3 did not, which is why this only had to be said once
    // the project moved. Disabled buttons keep the arrow: `disabled:pointer-events-none` below stops
    // them resolving a cursor at all.
    "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/80",
                outline:
                    "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
                ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
                destructive:
                    "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
                link: "text-primary underline-offset-4 hover:underline",
            },
            // Every size carries a `pointer-coarse:` floor of 44px — Apple's 44pt, Material's 48dp
            // and WCAG 2.2 SC 2.5.5 all land at or above it, and these variants were drawn for a
            // mouse: 24px at `icon-xs`, 28px at `icon-sm`, 32px at `icon`.
            //
            // The condition is the *pointer*, not the width. A touch laptop at 1440px has exactly
            // this problem and a mouse at 390px does not, so a width breakpoint would miss the first
            // and punish the second — and it keeps this off the desktop layouts that branches 1 and
            // 2 measured into place.
            //
            // The box grows rather than a `::after` extending the hit area past it. That trick keeps
            // the visual size, and it is wrong here: these buttons sit on `gap-2` in the top bar, so
            // 6px of invisible overhang per side would have each one overlapping its neighbour by
            // 4px, where a tap goes to whatever paints last instead of to what was aimed at. An
            // invisible overlapping target is a worse defect than a small one.
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
