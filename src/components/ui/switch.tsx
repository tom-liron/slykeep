"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * An on/off control for a setting that takes effect immediately.
 *
 * A switch rather than a checkbox because nothing here is submitted: word wrap and the minimap are
 * on the moment they are flipped, and a checkbox is the shape that implies a form and a save button.
 *
 * The focus ring is `button`'s, so a keyboard walking through a settings panel is outlined the same
 * way on a toggle as on the buttons above it.
 *
 * This is the one control that grows its *hit area* on a touch screen rather than its box, and the
 * exception is deliberate. A switch's size is its design — 20×36 is what reads as a switch, and a
 * 44px one reads as a lozenge — while `Button`'s sizes are just sizes, so there the box grows. The
 * trick that makes a hit area exceed a box is only safe where nothing else is within reach of the
 * overhang, and here nothing is: each switch is alone at the end of a `PanelRow` that carries a
 * title and a description, so the nearest other target is a whole row away.
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            className={cn(
                "peer relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                // 20×36 becomes 46×46 to a thumb, and stays 20×36 to the eye.
                //
                // The insets are 6px and 14px rather than the 4px and 12px the arithmetic asks for,
                // because an absolutely positioned pseudo-element is sized from its origin's
                // *padding* box and this switch has a 1px transparent border on every side. At the
                // arithmetic values it measured 42×42 — under the floor, and by so little that
                // probes on opposite edges disagreed with each other.
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
