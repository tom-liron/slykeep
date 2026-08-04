"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * "Send me another link" — the way out of an expired, spent, or never-delivered verification email.
 *
 * Without it an unverified account is simply lost: the password is correct, the account exists, and
 * nothing in the UI can issue a new link. `POST /api/auth/verify-email` answers 200 for every input
 * so that this control cannot be used to test which addresses are registered, which is why the
 * confirmation below is phrased as what *would* happen rather than what did.
 */
export function ResendVerification({ defaultEmail = "" }: { defaultEmail?: string }) {
    const [email, setEmail] = useState(defaultEmail);
    const [isPending, setIsPending] = useState(false);
    const [sent, setSent] = useState(false);
    // The one outcome this control is allowed to report. A 429 is a fact about how often this
    // browser has asked for a link for this address, which the person asking already knows, so it
    // discloses nothing the confirmation below is built to hide — and claiming a link is on its way
    // when the server refused to send one would strand them waiting on an empty inbox.
    const [limitError, setLimitError] = useState<string | null>(null);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsPending(true);
        setLimitError(null);

        try {
            const response = await fetch("/api/auth/verify-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            if (response.status === 429) {
                const body = await response.json().catch(() => null);

                setLimitError(body?.error ?? "Too many attempts. Try again later.");
                setIsPending(false);
                return;
            }
        } catch {
            // Still swallowed. Every other response is a 200 the endpoint gives to all input alike,
            // so a network failure and a refused address remain indistinguishable here — surfacing
            // one but not the other would leak exactly the difference the endpoint is built to hide.
        }

        setIsPending(false);
        setSent(true);
    }

    if (sent) {
        return (
            <p className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
                Check your email — if <span className="font-medium">{email}</span> still needs
                confirming, a new link is on its way. It expires in 24 hours.
            </p>
        );
    }

    // The wrapper exists so the message can sit *under* the row: the form itself is `sm:flex-row`,
    // and a paragraph inside it would become a third column beside the field and the button.
    return (
        <div className="mt-3">
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2 sm:flex-row">
                <Input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-label="Email address for a new verification link"
                    required
                    className="sm:flex-1"
                />
                <Button type="submit" variant="outline" disabled={isPending || !email}>
                    {isPending ? "Sending…" : "Resend link"}
                </Button>
            </form>

            {limitError && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                    {limitError}
                </p>
            )}
        </div>
    );
}
