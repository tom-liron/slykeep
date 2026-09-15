import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The shadcn/ui text-input primitive: a styled `<input>` wrapper.
 *
 * The base single-line field for every form in the app. `Field` and `AuthField` wrap it with a
 * label and an error slot; `PasswordInput` adds a reveal toggle over it.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            type={type}
            data-slot="input"
            // `text-ellipsis` so text too long for the field ends in "…" rather than against a
            // hard edge mid-character. It sits on the element, not on `placeholder:`:
            // `::placeholder` only accepts the properties `::first-line` accepts, and
            // `text-overflow` is not among them, so a `placeholder:text-ellipsis` class is emitted
            // and computes to `clip`. On the element it clips both the placeholder and an
            // over-long value, and focusing the field still scrolls the text into view.
            //
            // This is a floor, not a substitute for the title-length budget in
            // `config/item-placeholders.ts` — an ellipsis still loses the end of the sentence.
            className={cn(
                "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base text-ellipsis transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-field dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
                className,
            )}
            {...props}
        />
    );
}

export { Input };
