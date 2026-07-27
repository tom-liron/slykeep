import type { Metadata } from "next";

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

            <RegisterForm />
        </div>
    );
}
