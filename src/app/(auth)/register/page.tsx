import type { Metadata } from "next";

import { AuthDivider } from "@/components/auth/AuthDivider";
import { GitHubSignInButton } from "@/components/auth/GitHubSignInButton";
import { RegisterForm } from "@/components/auth/RegisterForm";

/**
 * The `/register` page: GitHub sign-up above the credentials form, in the same order `/sign-in`
 * uses so the two screens do not feel mismatched.
 *
 * The page takes no `searchParams` or `callbackUrl`: it is not reached from a protected-page bounce.
 * GitHub sign-in uses the default dashboard destination; credentials registration redirects to
 * `/sign-in` from {@link RegisterForm}.
 */
export const metadata: Metadata = {
    title: "Create an account · SlyKeep",
};

export default function RegisterPage() {
    return (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6 space-y-1">
                <h1 className="text-xl font-semibold">Create your account</h1>
                <p className="text-sm text-muted-foreground">
                    Start stashing snippets, prompts, and commands.
                </p>
            </div>

            {/* Above the form, matching `/sign-in`: the two screens differ by one field, and a
                GitHub button that swapped sides between them would read as an inconsistency. */}
            <GitHubSignInButton />

            <AuthDivider />

            <RegisterForm />
        </div>
    );
}
