import type { Metadata } from "next";
import Link from "next/link";

import { signOutToSignIn } from "@/actions/auth";
import { auth } from "@/auth";
import { ResendVerification } from "@/components/auth/ResendVerification";
import { Button } from "@/components/ui/button";
import { parseVerificationOutcome, type VerificationOutcome } from "@/lib/verification-outcomes";

export const metadata: Metadata = {
    title: "Email verification",
};

/**
 * The heading and sentence for each outcome, saying what the click did and nothing about what to do
 * next — the action block below decides that from the session, which the outcome alone cannot.
 *
 * @remarks
 * Declarative and contraction-free throughout, the two dead-link outcomes included: those are read
 * while something has gone wrong, and call for a plain, serious register.
 */
const OUTCOME_COPY: Record<VerificationOutcome, { heading: string; body: string }> = {
    verified: {
        heading: "Email confirmed",
        body: "Your email address is confirmed and the account is ready to use.",
    },
    "already-verified": {
        heading: "Email already confirmed",
        body: "This address was confirmed earlier, so the link had no further effect.",
    },
    expired: {
        heading: "This verification link has expired",
        body: "Verification links are valid for 24 hours, and this one is past that.",
    },
    invalid: {
        heading: "This verification link is not valid",
        body: "It has already been used, or it is not a link we issued.",
    },
};

/**
 * Where a verification link lands: it reports what the click did and offers the next step that
 * follows from it — or, when which account the visitor is dealing with is unsettled, both of them.
 *
 * `GET /api/auth/verify-email` has already consumed the token and applied the result by the time
 * anyone arrives here, so this page only reads `?status=` and renders. It owns a page rather than
 * borrowing a banner on `/sign-in` because the link is opened from an inbox, in a browser that may
 * already hold a session: `/sign-in` is a signed-out route, and the proxy would send a signed-in
 * visitor to `/` with the outcome still in the query string it discarded.
 *
 * @see `OPEN_ROUTES` in `lib/auth-redirects.ts`, which is what makes this path reachable either way.
 */
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

    // Set by the route handler when the token's address is not the one this session belongs to. The
    // param is forgeable, and forging it buys only the choice below — no account state is read from
    // it, and the address it names is the visitor's own.
    const otherAccount = signedInAs !== null && params.mismatch === "1";

    // `invalid` is the one outcome with no address behind it: the row is gone, so the route had
    // nothing to compare the session against, and the page must not assume the session owns the
    // link. It is the ordinary second click on a dead link: an expired link is spent by the click
    // that reports it expired.
    const unknownAccount = signedInAs !== null && !otherAccount && outcome === "invalid";

    // Whose account this is about is unsettled in both cases, so both ways off the page are offered
    // and neither is guessed at: someone dealing with a second account on their own machine wants
    // to stay where they are, and someone on a shared one does not.
    const offerChoice = otherAccount || unknownAccount;

    // The one-way label, for when the account *is* settled: every outcome but `invalid` carries an
    // address, so no mismatch on one of those means the route compared and they matched.
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
                {/* The address is named whenever there is a session, because on this page it is
                    the one fact the visitor cannot check for themselves and everything else turns
                    on. What follows it is what to do about it, never why the page cannot tell
                    which account a spent link named. */}
                {signedInAs !== null && (
                    <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
                        <p>
                            Signed in as <span className="font-medium">{signedInAs}</span>
                            {otherAccount &&
                                ". That link was for a different account, so nothing about this session changed."}
                            {unknownAccount &&
                                ". If you were confirming a different account, send a new link to that address below."}
                            {!offerChoice && "."}
                        </p>
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
                    {offerChoice ? (
                        // Both outline. A solid button on this page marks the recommended step, and
                        // here the page cannot know which one the visitor wants, so neither is
                        // emphasised.
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button asChild variant="outline" className="sm:flex-1">
                                <Link href="/">Stay signed in</Link>
                            </Button>

                            {/* A form, not a link: the session has to be cleared on the server
                                before `/sign-in` is worth anything, and the proxy would bounce a
                                signed-in visitor straight off it. */}
                            <form action={signOutToSignIn} className="sm:flex-1">
                                <Button type="submit" variant="outline" className="w-full">
                                    Sign out and switch account
                                </Button>
                            </form>
                        </div>
                    ) : (
                        // Solid only when this is the one step left. On a dead link it stays
                        // outline so it does not out-shout the resend field, which is what actually
                        // resolves the situation.
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
