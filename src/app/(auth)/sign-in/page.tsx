import type { Metadata } from "next";

import { GitHubSignInButton } from "@/components/auth/GitHubSignInButton";
import { ResendVerification } from "@/components/auth/ResendVerification";
import { SignInForm } from "@/components/auth/SignInForm";
import { getSignInErrorMessage } from "@/lib/auth-errors";
import { resolveCallbackUrl } from "@/lib/auth-redirects";

export const metadata: Metadata = {
    title: "Sign in · DevStash",
};

export default async function SignInPage({
    searchParams,
}: {
    searchParams: Promise<{
        registered?: string;
        verified?: string;
        reset?: string;
        callbackUrl?: string | string[];
        error?: string | string[];
    }>;
}) {
    const params = await searchParams;

    // Written by `src/proxy.ts` when it bounced a signed-out visitor off a protected page. Validated
    // here, at the edge of the request, so neither form can be handed a destination that leaves the
    // site — and validated again in the action, since the hidden field it produces is just as
    // forgeable as the query param.
    const callbackUrl = resolveCallbackUrl(params.callbackUrl) ?? undefined;

    // Set by the reset form's redirect once the new password is saved.
    const justReset = params.reset === "1";

    // Set by the register form's redirect. `unsent` is the honest case: the account exists but
    // Resend refused, so pointing at an inbox would be a lie — offer the resend control instead.
    const justRegistered = params.registered === "sent";
    const emailFailed = params.registered === "unsent";

    // Set by the redirect out of `GET /api/auth/verify-email`. `already` covers a link clicked
    // twice, which is a success from the user's point of view even though nothing changed.
    const justVerified = params.verified === "1";
    const alreadyVerified = params.verified === "already";

    // Auth.js redirects a failed sign-in here with the reason in `?error=` (see `auth-errors.ts`).
    // Reading it is what stops a blocked GitHub sign-in from bouncing the user back to a clean form
    // with no explanation, leaving the cause visible only in the server logs.
    const errorMessage = getSignInErrorMessage(params.error);

    // Both verification-link failures leave the account intact and only the link spent, so the
    // remedy is always a fresh one rather than support.
    const needsNewLink =
        params.error === "VerificationExpired" || params.error === "VerificationInvalid";

    return (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            {/* Deliberately not "Welcome back". Until a homepage exists, `src/proxy.ts` bounces every
                signed-out visitor here, so this page is the app's front door and greets first-time
                arrivals as often as returning ones. The subtitle says what DevStash is for the same
                reason. The post-sign-in toast can still say "welcome back" — by then the account has
                authenticated, so the assumption is earned. */}
            <div className="mb-6 space-y-1">
                <h1 className="text-xl font-semibold">Sign in to DevStash</h1>
                <p className="text-sm text-muted-foreground">
                    One place for your snippets, prompts, commands, and notes.
                </p>
            </div>

            {/* Above the GitHub button, because that is the control that just failed — and the
                OAuthAccountNotLinked message sends the user to the credentials form below it. */}
            {errorMessage && (
                <div className="mb-5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <p role="alert">{errorMessage}</p>
                    {/* A dead verification link is the one error the user can fix from here, so the
                        message comes with the control that fixes it rather than just an apology. */}
                    {needsNewLink && <ResendVerification />}
                </div>
            )}

            {justReset && (
                <p className="mb-5 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
                    Password updated. Sign in with your new one.
                </p>
            )}

            {justVerified && (
                <p className="mb-5 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
                    Email confirmed. Sign in to get started.
                </p>
            )}

            {alreadyVerified && (
                <p className="mb-5 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
                    That email was already confirmed. Sign in to continue.
                </p>
            )}

            {justRegistered && (
                <div className="mb-5 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
                    <p>
                        Account created. Check your inbox for a confirmation link — it expires in 24
                        hours, and you will not be able to sign in until you use it.
                    </p>
                    {/* Offered even on the success path, because "sent" only ever means Resend
                        accepted the request. Delivery is settled afterwards, so an email that
                        never arrives looks exactly like this screen — and without a way to ask
                        for another one from here, the next step would be giving up. */}
                    <p className="mt-2 text-muted-foreground">Didn&apos;t get it?</p>
                    <ResendVerification />
                </div>
            )}

            {emailFailed && (
                <div className="mb-5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <p role="alert">
                        Your account was created, but the confirmation email could not be sent. You
                        will not be able to sign in until the address is confirmed.
                    </p>
                    <ResendVerification />
                </div>
            )}

            <GitHubSignInButton callbackUrl={callbackUrl} />

            <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground uppercase">or</span>
                <span className="h-px flex-1 bg-border" />
            </div>

            <SignInForm callbackUrl={callbackUrl} />
        </div>
    );
}
