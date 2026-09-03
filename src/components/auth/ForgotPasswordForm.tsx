"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Asks for the address to send a reset link to, then shows the confirmation.
 *
 * The whole `/forgot-password` page's body, heading included — the heading changes between the
 * form ("Reset your password") and the confirmation ("Check your email").
 *
 * @remarks
 * `POST /api/auth/forgot-password` answers 200 for every input so this cannot test which emails
 * are registered, so the confirmation is worded as what *would* have happened and reads the same
 * for every address. It still names the address, since a typo is the likeliest reason nothing
 * arrives.
 */
export function ForgotPasswordForm() {
    const [email, setEmail] = useState("");
    const [isPending, setIsPending] = useState(false);
    const [sentTo, setSentTo] = useState<string | null>(null);
    // The one outcome this form reports. A 429 is a fact about how often this browser has posted
    // here, not about any address, so it discloses nothing the confirmation hides — and it must be
    // shown, or a "link on its way" for a refused request leaves the user waiting on nothing.
    const [limitError, setLimitError] = useState<string | null>(null);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsPending(true);
        setLimitError(null);

        try {
            const response = await fetch("/api/auth/forgot-password", {
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
            // so a network failure and an unknown address remain indistinguishable here — surfacing
            // one but not the other would leak exactly the difference the endpoint is built to hide.
        }

        setIsPending(false);
        setSentTo(email);
    }

    if (sentTo) {
        return (
            <>
                <div className="mb-6 space-y-2">
                    <h1 className="text-xl font-semibold">Check your email</h1>
                    <p className="text-sm text-muted-foreground">
                        If <span className="font-medium text-foreground">{sentTo}</span> has a
                        DevStash account, a link to reset your password is on its way.
                    </p>
                </div>

                <div className="space-y-4 text-sm">
                    <p className="text-muted-foreground">
                        The link expires in 1 hour. Nothing in your inbox? Check your spam folder,
                        or{" "}
                        {/* Returning to the form beats making them navigate back and start over —
                            mistyping the address is the likeliest reason a link never arrives. */}
                        <button
                            type="button"
                            onClick={() => setSentTo(null)}
                            className="cursor-pointer font-medium text-foreground underline underline-offset-2"
                        >
                            try a different address
                        </button>
                        .
                    </p>
                    <p>
                        <Link
                            href="/sign-in"
                            className="font-medium text-foreground hover:underline"
                        >
                            Back to sign in
                        </Link>
                    </p>
                </div>
            </>
        );
    }

    // `noValidate` as on the sign-in form: a native `type="email"` rejection does not survive a
    // React submit handler, so it would refuse with no message.
    return (
        <>
            <div className="mb-6 space-y-1">
                <h1 className="text-xl font-semibold">Reset your password</h1>
                <p className="text-sm text-muted-foreground">
                    Enter your account&apos;s email address and we&apos;ll send you a reset link.
                </p>
            </div>

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

                {limitError && (
                    <p role="alert" className="text-sm text-destructive">
                        {limitError}
                    </p>
                )}

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
        </>
    );
}
