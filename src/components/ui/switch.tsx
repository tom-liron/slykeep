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
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            className={cn(
                "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
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
