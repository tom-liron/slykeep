"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * "Send me another link" — the way out of an expired, spent, or never-delivered verification email.
 *
 * Rendered inside `SignInForm` after an unverified credentials sign-in and directly by the sign-in
 * page's registration, verification-link-failure, and email-failure banners. Apart from the 429
 * rate-limit response, `POST /api/auth/verify-email` answers 200 for every input, so the
 * confirmation is phrased as what *would* happen.
 *
 * @remarks
 * A plain container with a `type="button"`, not a `<form>`: it renders inside `SignInForm`'s
 * form, and a form may not contain a form. That also makes the field a child of the sign-in form,
 * so it carries no `name` (nothing here reads `FormData`, and a second `email` entry would ride
 * along with the credentials), and Enter is handled explicitly so the key does not resubmit the
 * sign-in form.
 */
export function ResendVerification({
    defaultEmail = "",
    knownEmail = false,
}: {
    defaultEmail?: string;
    /**
     * Renders the button alone, without the address field.
     *
     * For callers that already know whose address it is — the signed-in banner — where a field is
     * something to mistype rather than something to fill in.
     */
    knownEmail?: boolean;
}) {
    const [email, setEmail] = useState(defaultEmail);
    const [isPending, setIsPending] = useState(false);
    const [sent, setSent] = useState(false);
    // The one outcome this control is allowed to report. A 429 is a fact about how often this
    // browser has asked for a link for this address, which the person asking already knows, so it
    // discloses nothing the confirmation below is built to hide — and claiming a link is on its way
    // when the server refused to send one would strand them waiting on an empty inbox.
    const [limitError, setLimitError] = useState<string | null>(null);

    async function requestLink() {
        if (isPending || !email) return;

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

    if (knownEmail) {
        // No margin of its own: this form is laid out by its caller, which sits it in a row beside
        // the message rather than under it.
        return (
            <div>
                <Button
                    type="button"
                    onClick={() => void requestLink()}
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                >
                    {isPending ? "Sending…" : "Resend link"}
                </Button>

                {limitError && (
                    <p role="alert" className="mt-2 text-sm text-destructive">
                        {limitError}
                    </p>
                )}
            </div>
        );
    }

    // The outer wrapper exists so the message can sit *under* the row: the row is `sm:flex-row`, and
    // a paragraph inside it would become a third column beside the field and the button.
    return (
        <div className="mt-3">
            <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    // Enter would otherwise reach the sign-in form this field sits inside and
                    // resubmit the credentials that just failed.
                    onKeyDown={(event) => {
                        if (event.key !== "Enter") return;

                        event.preventDefault();
                        void requestLink();
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-label="Email address for a new verification link"
                    aria-required
                    className="sm:flex-1"
                />
                {/* `type="button"`, or it submits the sign-in form rather than calling this. */}
                <Button
                    type="button"
                    onClick={() => void requestLink()}
                    variant="outline"
                    disabled={isPending || !email}
                >
                    {isPending ? "Sending…" : "Resend link"}
                </Button>
            </div>

            {limitError && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                    {limitError}
                </p>
            )}
        </div>
    );
}
