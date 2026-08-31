import type { Metadata } from "next";

import { AuthDivider } from "@/components/auth/AuthDivider";
import { GitHubSignInButton } from "@/components/auth/GitHubSignInButton";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
    title: "Create an account · DevStash",
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

            {/* Above the form, in the order `/sign-in` uses. The two pages are the same screen with
                one field's difference, and a GitHub button that sits on top on one of them and
                underneath on the other is the kind of asymmetry nobody reports and everybody feels.

                No `callbackUrl`: this route takes no search params, and there is nowhere to come
                back to — a registration that resolves to an existing account lands on the dashboard,
                which is the action's own default. */}
            <GitHubSignInButton />

            <AuthDivider />

            <RegisterForm />
        </div>
    );
}
