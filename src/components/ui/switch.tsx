"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * The shadcn/ui switch primitive: an on/off control for a setting that applies immediately.
 *
 * Used in the editor-preferences panel (word wrap, minimap). A switch rather than a checkbox
 * because nothing here is submitted — a checkbox implies a form and a save button. The focus ring
 * is `button`'s, so a keyboard walking a settings panel is outlined the same way on a toggle as on
 * the buttons above it.
 *
 * @remarks
 * On a coarse pointer this grows its *hit area* to the 44px floor rather than its box — the one
 * `ui/` control that does. A switch's 20×36 box is its design; a 44px box reads as a lozenge. The
 * invisible `::after` overhang is safe here only because each switch sits alone at the end of a
 * `PanelRow`, a whole row away from the nearest other target. Controls whose size is arbitrary
 * (`ui/button.tsx`, `ui/ToggleChip.tsx`) grow the box instead.
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            className={cn(
                "peer relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                // The `::after` overhang extends the 20×36 box to 46×46 for a touch pointer while
                // the painted switch stays 20×36. The insets are 6px and 14px, not the 4px and
                // 12px the arithmetic gives: an absolutely positioned pseudo-element is sized from
                // its origin's *padding* box, and this switch carries a 1px transparent border on
                // every side, so the plain arithmetic lands 2px under the 44px floor.
                "pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1.5 pointer-coarse:after:-inset-y-3.5 pointer-coarse:after:content-['']",
                "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/50",
                className,
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className={cn(
                    "pointer-events-none block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform",
                    "data-[state=checked]:translate-x-[calc(100%+2px)] data-[state=unchecked]:translate-x-0.5",
                )}
            />
        </SwitchPrimitive.Root>
    );
}

export { Switch };
