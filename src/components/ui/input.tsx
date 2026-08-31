import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            type={type}
            data-slot="input"
            // `text-ellipsis` so text too long for the field ends in "…" rather than against a
            // hard edge mid-character, which reads as a rendering fault. The field is
            // `text-base` until `md`, so every phone renders 16px and a 320px viewport leaves
            // 215px of content box — narrow enough that this is reachable, and has been reached
            // by a placeholder twice.
            //
            // On the element and not `placeholder:text-ellipsis`, which looks like the more
            // precise way to say it and does nothing: `::placeholder` only accepts the
            // properties `::first-line` accepts, and `text-overflow` is not among them — the
            // rule is emitted, the class lands, and the computed value is still `clip` with
            // `!important` on it. Verified in the browser rather than assumed, both that the
            // pseudo-element refuses it and that the element renders the ellipsis.
            //
            // It reaches the *value* as well, deliberately: an over-long title in a narrow
            // field now ends in "…" instead of a chopped character, and focusing it scrolls
            // the text as before. And it is the floor under the length budget in
            // `config/item-placeholders.ts`, not a licence to skip it — an ellipsis still
            // loses the end of the sentence.
            className={cn(
                "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base text-ellipsis transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
                className,
            )}
            {...props}
        />
    );
}

export { Input };
