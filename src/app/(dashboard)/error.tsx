"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RouteNotice } from "@/components/ui/RouteNotice";

/**
 * The error boundary for a signed-in page that threw — a query that failed, a component that could
 * not render.
 *
 * It exists so that failure keeps the sidebar and top bar, the same reason `(dashboard)/not-found.tsx`
 * does: the nearest boundary otherwise is the root `error.tsx`, which renders outside this group's
 * layout and would strip the app chrome from a reader who is still signed in. A failure of the
 * layout itself still lands there, since a boundary cannot catch the layout it renders inside.
 *
 * `reset` re-renders the failed segment alone, so a transient failure recovers without reloading
 * the shell around it.
 */
export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    // The browser sees a redacted message in production; the digest is what ties it to the full
    // stack in the server log, which is why it is both logged and shown.
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <RouteNotice
            icon={TriangleAlert}
            code={error.digest ? `500 · ${error.digest}` : "500"}
            title="This page didn't load"
            description="Something failed while building it. Trying again is usually enough — if it keeps happening, the reference above identifies it in the logs."
            tone="destructive"
        >
            <Button onClick={reset}>Try again</Button>
            <Button asChild variant="outline">
                <Link href="/">Back to the dashboard</Link>
            </Button>
        </RouteNotice>
    );
}
