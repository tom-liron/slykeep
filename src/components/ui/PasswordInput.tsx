"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A password field with a show/hide toggle, wrapping {@link Input}.
 *
 * Used by every credentials form — sign-in, register, reset, and the change-password dialog — so a
 * user can check what they typed before submitting. The toggle is a `button`, not a checkbox, so
 * it stays out of the form's submitted data.
 */
export function PasswordInput({
    className,
    ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
    const [visible, setVisible] = useState(false);
    const Icon = visible ? EyeOff : Eye;

    return (
        <div className="relative">
            <Input
                {...props}
                type={visible ? "text" : "password"}
                className={cn("pr-9", className)}
            />
            <button
                type="button"
                onClick={() => setVisible((current) => !current)}
                // The label states the action, not the state — a screen reader user needs to know
                // what pressing it does, and `aria-pressed` carries the state separately.
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-glow"
            >
                <Icon className="size-4" aria-hidden="true" />
            </button>
        </div>
    );
}
