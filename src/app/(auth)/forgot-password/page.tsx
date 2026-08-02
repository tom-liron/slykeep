import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
    title: "Reset your password · DevStash",
};

export default function ForgotPasswordPage() {
    return (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6 space-y-1">
                <h1 className="text-xl font-semibold">Reset your password</h1>
                <p className="text-sm text-muted-foreground">
                    Enter your email and we&apos;ll send you a link to choose a new one.
                </p>
            </div>

            <ForgotPasswordForm />
        </div>
    );
}
