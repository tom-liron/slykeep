import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { checkPasswordResetToken } from "@/server/verification";

export const metadata: Metadata = {
    title: "Choose a new password · DevStash",
};

/**
 * Where a reset link lands.
 *
 * The token is checked here but deliberately *not* consumed: it still has to work when the form this
 * renders is submitted. Checking first is what stops someone choosing and confirming a password only
 * to be told afterwards that the link died an hour ago.
 *
 * It is a page rather than a route handler — unlike `GET /api/auth/verify-email`, which can finish
 * its whole job on the click — because a reset needs the person to type something first.
 */
const DEAD_LINK_MESSAGE = {
    expired: "That reset link has expired. Links are good for 1 hour, and this one is past it.",
    invalid: "That reset link is not valid or has already been used.",
} as const;

export default async function ResetPasswordPage({
    searchParams,
}: {
    searchParams: Promise<{ token?: string | string[] }>;
}) {
    const { token } = await searchParams;

    // A duplicated param (`?token=a&token=b`) arrives as an array. Nothing legitimate produces one,
    // and there is no sensible way to pick between them, so it is treated as a broken link.
    const raw = typeof token === "string" ? token : "";
    const state = await checkPasswordResetToken(raw);

    if (state !== "valid") {
        return (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-6 space-y-1">
                    <h1 className="text-xl font-semibold">This link won&apos;t work</h1>
                    <p className="text-sm text-muted-foreground">{DEAD_LINK_MESSAGE[state]}</p>
                </div>

                {/* The account is intact in both cases — only the link is spent — so the remedy is
                    always a fresh one rather than support. */}
                <div className="space-y-3 text-sm">
                    <Link
                        href="/forgot-password"
                        className="font-medium text-foreground hover:underline"
                    >
                        Request a new reset link
                    </Link>
                    <p className="text-muted-foreground">
                        <Link href="/sign-in" className="hover:underline">
                            Back to sign in
                        </Link>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6 space-y-1">
                <h1 className="text-xl font-semibold">Choose a new password</h1>
                <p className="text-sm text-muted-foreground">
                    Pick something you haven&apos;t used before. You&apos;ll sign in with it next.
                </p>
            </div>

            <ResetPasswordForm token={raw} />
        </div>
    );
}
