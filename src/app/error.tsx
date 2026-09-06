"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RouteNotice } from "@/components/ui/RouteNotice";

/**
 * The error boundary for everything below the root layout: a server component that threw, or a
 * client component that failed while rendering.
 *
 * A client component, as every `error.tsx` must be — it holds the retry. `reset` re-renders the
 * segment that failed, which recovers a transient failure (a dropped database connection, a rate
 * limit that has since expired) without a full page load.
 *
 * A failure of the root layout itself is caught one level up, by `global-error.tsx`.
 */
export default function GlobalRouteError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    // The browser sees a redacted message in production; the digest is the key that ties it to the
    // full stack in the server log, which is why it is both logged and shown.
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex min-h-dvh flex-col bg-background md:h-dvh md:overflow-y-auto">
            <RouteNotice
                icon={TriangleAlert}
                code={error.digest ? `500 · ${error.digest}` : "500"}
                title="Something went wrong"
                description="This page failed to load. Trying again is usually enough — if it keeps happening, the error reference above identifies it in the logs."
                tone="destructive"
            >
                <Button onClick={reset}>Try again</Button>
                <Button asChild variant="outline">
                    <Link href="/">Go to the dashboard</Link>
                </Button>
            </RouteNotice>
        </div>
    );
}
