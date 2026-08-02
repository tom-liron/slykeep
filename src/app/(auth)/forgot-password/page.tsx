import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
    title: "Reset your password · DevStash",
};

/**
 * The card only. Its heading belongs to `ForgotPasswordForm`, which swaps it for "Check your email"
 * once a link has been requested — a header rendered out here could not follow that.
 */
export default function ForgotPasswordPage() {
    return (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <ForgotPasswordForm />
        </div>
    );
}
