"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorReference } from "@/components/ui/ErrorReference";
import { RouteNotice } from "@/components/ui/RouteNotice";

/**
 * The error boundary for the signed-out account pages — sign-in, register, forgot and reset
 * password, verify email.
 *
 * It exists for the way out it offers rather than for the message. The nearest boundary otherwise is
 * the root `error.tsx`, whose second action is "Go to the dashboard": a visitor who has not signed
 * in yet is bounced straight back to the page that just failed. This one sends them to the homepage
 * and keeps the marketing bar above it, since it renders inside this group's layout.
 *
 * A failed sign-in is not this surface. Auth.js returns those to `/sign-in` as an `?error=` code,
 * which `lib/auth-errors.ts` turns into a sentence on the form itself; this catches the page failing
 * to render at all.
 */
export default function AuthError({
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
        <RouteNotice
            icon={TriangleAlert}
            code="500"
            title="This page didn't load"
            description="Something failed while building it. Trying again is usually enough."
            tone="destructive"
            reference={<ErrorReference digest={error.digest} />}
        >
            <Button onClick={reset}>Try again</Button>
            <Button asChild variant="outline">
                <Link href="/welcome">Back to the homepage</Link>
            </Button>
        </RouteNotice>
    );
}
