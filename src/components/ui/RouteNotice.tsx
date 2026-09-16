import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The full-page message the app shows in place of a route it cannot render: a 404, a thrown server
 * component, or the root-layout fallback.
 *
 * `app/not-found.tsx` and `app/error.tsx` compose it, as do the `(dashboard)` group's own pair — so a
 * mistyped URL and a crashed page arrive at the same surface instead of at two of Next's unstyled
 * defaults. `app/global-error.tsx` is the exception: it stands in for the root layout, so it repeats
 * this shape inline rather than depending on it. Presentational and server-safe; the actions are
 * passed in as children because each route offers a different way out.
 *
 * @remarks
 * Every use of this component is a dead end unless it is given one — always pass at least one
 * action that leads back into the app.
 */
export function RouteNotice({
    icon: Icon,
    code,
    title,
    description,
    tone = "muted",
    reference,
    children,
}: {
    icon: LucideIcon;
    /** The HTTP-shaped label above the heading — "404", "500". */
    code: string;
    title: string;
    description: string;
    /** `destructive` tints the mark and code for a failure, as against a missing page. */
    tone?: "muted" | "destructive";
    /**
     * A support code to show under the description — `ErrorReference` in
     * `components/ui/ErrorReference.tsx`, for the error boundaries. The 404s pass nothing, which is
     * what keeps this component server-safe.
     */
    reference?: React.ReactNode;
    children: React.ReactNode;
}) {
    const destructive = tone === "destructive";

    return (
        // Centres in the space it is given and scrolls itself from `md` up, the two scroll models
        // the root layout sets. Inside the dashboard shell the parent is already a scrolling pane,
        // so `min-h-full` fills it rather than the viewport.
        <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
            <div className="w-full max-w-md text-center">
                <span
                    className={cn(
                        "inline-flex size-12 items-center justify-center rounded-xl",
                        destructive ? "bg-destructive/10 text-destructive" : "bg-muted",
                    )}
                >
                    <Icon className="size-6" aria-hidden="true" />
                </span>

                <p
                    className={cn(
                        "mt-6 font-mono text-sm",
                        destructive ? "text-destructive" : "text-muted-foreground",
                    )}
                >
                    {code}
                </p>
                <h1 className="mt-1 text-2xl font-bold text-balance">{title}</h1>
                <p className="mt-3 text-sm text-pretty text-muted-foreground">{description}</p>

                {reference}

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    {children}
                </div>
            </div>
        </div>
    );
}
