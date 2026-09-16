"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorReference } from "@/components/ui/ErrorReference";
import { RouteNotice } from "@/components/ui/RouteNotice";

/**
 * The error boundary for the public pages — the landing page, `/privacy` and `/terms`.
 *
 * Rendering inside this group's layout is what it is for: the marketing bar and footer stay, and the
 * second action leads to sign-in rather than to the root boundary's "Go to the dashboard", which a
 * visitor with no session cannot reach. The landing page is also what `/` serves to a signed-out
 * visitor, so this is the boundary for the first page most people ever see.
 */
export default function MarketingError({
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
        // The group's `main` sets no height, so the notice is given one here rather than sitting
        // against the bar.
        <div className="flex min-h-[60dvh] flex-col">
            <RouteNotice
                icon={TriangleAlert}
                code="500"
                title="Something went wrong"
                description="This page failed to load. Trying again is usually enough."
                tone="destructive"
                reference={<ErrorReference digest={error.digest} />}
            >
                <Button onClick={reset}>Try again</Button>
                <Button asChild variant="outline">
                    <Link href="/sign-in">Sign in</Link>
                </Button>
            </RouteNotice>
        </div>
    );
}
