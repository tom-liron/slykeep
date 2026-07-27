import type { Metadata } from "next";

import { GitHubSignInButton } from "@/components/auth/GitHubSignInButton";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = {
    title: "Sign in · DevStash",
};

export default async function SignInPage({
    searchParams,
}: {
    searchParams: Promise<{ registered?: string }>;
}) {
    // Set by the register form's redirect, so a new account gets an acknowledgement instead of
    // landing on a bare sign-in form wondering whether anything happened.
    const justRegistered = (await searchParams).registered === "1";

    return (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6 space-y-1">
                <h1 className="text-xl font-semibold">Welcome back</h1>
                <p className="text-sm text-muted-foreground">Sign in to get back to your stash.</p>
            </div>

            {justRegistered && (
                <p className="mb-5 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
                    Account created. Sign in to continue.
                </p>
            )}

            <GitHubSignInButton />

            <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground uppercase">or</span>
                <span className="h-px flex-1 bg-border" />
            </div>

            <SignInForm />
        </div>
    );
}
