"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Asks for the address to send a reset link to.
 *
 * The confirmation is phrased as what *would* happen rather than what did, and it is the same
 * message for every address. `POST /api/auth/forgot-password` answers 200 for all input precisely so
 * this control cannot be used to test which emails are registered — saying "sent!" for one address
 * and "no such account" for another would hand that back in the UI.
 */
export function ForgotPasswordForm() {
    const [email, setEmail] = useState("");
    const [isPending, setIsPending] = useState(false);
    const [sent, setSent] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsPending(true);

        try {
            await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
        } catch {
            // Swallowed on purpose. The endpoint reports nothing either way, so a network failure
            // and an unknown address are already indistinguishable here — surfacing one but not the
            // other would leak exactly the difference the endpoint is built to hide.
        }

        setIsPending(false);
        setSent(true);
    }

    if (sent) {
        return (
            <div className="space-y-4">
                <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
                    If that address has a DevStash account, a reset link is on its way. It expires
                    in 1 hour and can only be used once.
                </p>
                <p className="text-center text-sm text-muted-foreground">
                    <Link href="/sign-in" className="font-medium text-foreground hover:underline">
                        Back to sign in
                    </Link>
                </p>
            </div>
        );
    }

    // `noValidate` for the same reason as the sign-in form: a native `type="email"` rejection does
    // not survive a React submit handler, so the field would refuse silently with no message.
    return (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium">
                    Email
                </label>
                <Input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                />
            </div>

            <Button type="submit" disabled={isPending || !email} className="w-full">
                {isPending ? "Sending…" : "Send reset link"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
                Remembered it?{" "}
                <Link href="/sign-in" className="font-medium text-foreground hover:underline">
                    Sign in
                </Link>
            </p>
        </form>
    );
}
