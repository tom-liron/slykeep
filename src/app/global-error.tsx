"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import "./globals.css";

/**
 * The last-resort boundary: it replaces the root layout, so it is what renders when the layout
 * itself throws and `error.tsx` — which lives inside that layout — can never mount.
 *
 * Because it stands in for the root layout it supplies its own `<html>` and `<body>`, imports the
 * stylesheet, and applies the `dark` class by hand. It renders its own markup rather than composing
 * `RouteNotice` and `ErrorReference`, and repeats their shape inline: the tree above this file is
 * broken by the time it renders, so it depends on as little of the application as it can. The
 * reference is not copyable here for the same reason — the copy control reports a failure through
 * the toaster the root layout mounts, and that layout is what is missing.
 *
 * @remarks
 * The root layout is where `next/font` defines `--font-sans`, and that layout is exactly what is
 * missing here — so the variable is supplied inline. Without it every class built on the theme font
 * falls back to the browser's default serif.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <html
            lang="en"
            className="dark h-full antialiased"
            style={{ "--font-sans": "ui-sans-serif, system-ui, sans-serif" } as React.CSSProperties}
        >
            <body className="min-h-full">
                <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-16 text-center">
                    <span className="inline-flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                        <TriangleAlert className="size-6" aria-hidden="true" />
                    </span>

                    <p className="mt-6 font-mono text-sm text-destructive">500</p>
                    <h1 className="mt-1 text-2xl font-bold text-balance">SlyKeep couldn’t load</h1>
                    <p className="mt-3 max-w-md text-sm text-pretty text-muted-foreground">
                        The application failed to start rendering. Reloading usually clears it.
                    </p>

                    {/* Absent for an error thrown in the browser: React hashes only what failed
                        while rendering on the server. */}
                    {error.digest ? (
                        <p className="mt-5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                            Error reference{" "}
                            <span className="font-mono text-foreground">{error.digest}</span>
                        </p>
                    ) : null}

                    <button
                        type="button"
                        onClick={reset}
                        className="mt-8 inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover pointer-coarse:h-11"
                    >
                        Reload
                    </button>
                </div>
            </body>
        </html>
    );
}
