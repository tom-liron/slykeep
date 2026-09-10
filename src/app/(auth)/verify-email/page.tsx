import type { Metadata } from "next";
import Link from "next/link";

import { signOutToSignIn } from "@/actions/auth";
import { auth } from "@/auth";
import { ResendVerification } from "@/components/auth/ResendVerification";
import { Button } from "@/components/ui/button";
import { parseVerificationOutcome, type VerificationOutcome } from "@/lib/verification-outcomes";

/**
 * Where a verification link lands: it reports what the click did and offers the one next step that
 * follows from it.
 *
 * `GET /api/auth/verify-email` has already consumed the token and applied the result by the time
 * anyone arrives here, so this page only reads `?status=` and renders. It owns a page rather than
 * borrowing a banner on `/sign-in` because the link is opened from an inbox, in a browser that may
 * already hold a session: `/sign-in` is a signed-out route, and the proxy would send a signed-in
 * visitor to `/` with the outcome still in the query string it discarded.
 *
 * @see `OPEN_ROUTES` in `lib/auth-redirects.ts`, which is what makes this path reachable either way.
 */

export const metadata: Metadata = {
    title: "Email verification",
};

/**
 * The heading and sentence for each outcome, saying what the click did and nothing about what to do
 * next — the action block below decides that from the session, which the outcome alone cannot.
 */
const OUTCOME_COPY: Record<VerificationOutcome, { heading: string; body: string }> = {
    verified: {
        heading: "Email confirmed",
        body: "Your email address is confirmed and the account is ready to use.",
    },
    "already-verified": {
        heading: "Already confirmed",
        body: "That address was confirmed earlier, so this link had nothing left to do.",
    },
    expired: {
        heading: "This link has expired",
        body: "Verification links are good for 24 hours, and this one is past it.",
    },
    invalid: {
        heading: "This link won't work",
        body: "That verification link is not valid, or it has already been used.",
    },
};

export default async function VerifyEmailPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string | string[]; mismatch?: string | string[] }>;
}) {
    const params = await searchParams;
    const outcome = parseVerificationOutcome(params.status);
    const { heading, body } = OUTCOME_COPY[outcome];

    const confirmed = outcome === "verified" || outcome === "already-verified";

    // Read here rather than passed in the redirect: it is this browser's own session, and showing
    // the address back to the person already signed in as it discloses nothing.
    const session = await auth();
    const signedInAs = session?.user?.email ?? null;

    // Set by the route handler when the token's address is not the one this session belongs to,
    // which it can tell for every outcome except `invalid`. The param is forgeable, and forging it
    // buys only the panel below — no account state is read from it, and the address it names is the
    // visitor's own.
    const otherAccount = signedInAs !== null && params.mismatch === "1";

    // Four labels for one button, because both halves of what it means vary: where it goes depends
    // on whether there is a session, and whether it is the next step or the way out depends on
    // whether anything was confirmed.
    const onwardLabel = signedInAs
        ? confirmed
            ? "Continue to your account"
            : "Back to your account"
        : confirmed
          ? "Sign in"
          : "Back to sign in";

    return (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6 space-y-1">
                <h1 className="text-xl font-semibold">{heading}</h1>
                <p className="text-sm text-muted-foreground">{body}</p>
            </div>

            <div className="space-y-4 text-sm">
                {/* Named whenever there is a session, not only on a mismatch: on `invalid` there is
                    no address to compare against, and "back to your account" is only unambiguous
                    once the page has said which account that is. */}
                {signedInAs !== null && (
                    <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
                        {otherAccount ? (
                            <p>
                                This browser is signed in as{" "}
                                <span className="font-medium">{signedInAs}</span>, which is a
                                different account from the one that link was for. Nothing about this
                                session changed.
                            </p>
                        ) : (
                            <p>
                                Signed in as <span className="font-medium">{signedInAs}</span>.
                            </p>
                        )}
                    </div>
                )}

                {!confirmed && (
                    <div>
                        {/* The account is intact in both dead-link cases — only the link is spent —
                            so the remedy is always a fresh one rather than support. The address is
                            asked for rather than assumed: the session, when there is one, may well
                            belong to a different account than the link did. */}
                        <p className="text-muted-foreground">
                            Enter the address that needs confirming and we will send another link.
                        </p>

                        <ResendVerification />
                    </div>
                )}

                {/* Separated from the resend control by a rule so it does not compete with it: on a
                    dead link, a new link is the action that actually resolves the situation, and
                    everything here is a way off the page for someone who cannot use it. */}
                <div className={confirmed ? undefined : "border-t border-border pt-4"}>
                    {otherAccount ? (
                        // Both choices are offered rather than one being guessed at: someone
                        // dealing with a second account on their own machine wants to stay where
                        // they are, and someone on a shared one does not.
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button asChild variant="outline" className="sm:flex-1">
                                <Link href="/">Stay signed in</Link>
                            </Button>

                            {/* A form, not a link: the session has to be cleared on the server
                                before `/sign-in` is worth anything, and the proxy would bounce a
                                signed-in visitor straight off it. */}
                            <form action={signOutToSignIn} className="sm:flex-1">
                                <Button type="submit" className="w-full">
                                    Sign out and switch account
                                </Button>
                            </form>
                        </div>
                    ) : (
                        <Button
                            asChild
                            variant={confirmed ? "default" : "outline"}
                            className="w-full"
                        >
                            <Link href={signedInAs ? "/" : "/sign-in"}>{onwardLabel}</Link>
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
