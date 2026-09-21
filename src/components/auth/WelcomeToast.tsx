"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * The toast messages, keyed by the `welcome` param's value.
 *
 * The greeting is "Welcome", which is true of both a returning sign-in and a newly registered
 * account's first: the same destination serves both, and nothing here distinguishes them. With no
 * usable name — an account whose `name` was its email address with an empty local part — it falls
 * back to the impersonal wording.
 */
const MESSAGES = {
    "signed-in": (name: string) => (name ? `Welcome, ${name}!` : "Welcome!"),
    // Set by `GET /api/auth/verify-email` when the link confirms the account already signed in
    // here. That click has no page of its own to land on — it belongs back in the app — so this
    // toast is the whole of the confirmation.
    verified: () => "Email confirmed. Thanks!",
} as const;

/**
 * Raises the post-sign-in toast, then strips the flag that triggered it.
 *
 * Mounted only on the dashboard home, this turns a `welcome` flag into a toast — the post-sign-in
 * greeting, or the confirmation of a verification link clicked while already signed in. It must
 * live at the redirect destination because whatever raised the flag is gone before a server
 * redirect completes.
 *
 * Clearing the param with `replace` prevents the toast from firing again on refresh.
 */
export function WelcomeToast({ name }: { name: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const welcome = searchParams.get("welcome");
    // Guards against the double-invoke of effects in development, which would otherwise stack two
    // identical toasts on top of each other.
    const shown = useRef(false);

    useEffect(() => {
        if (!welcome || shown.current) return;

        const message = MESSAGES[welcome as keyof typeof MESSAGES];

        if (message) {
            shown.current = true;
            toast.success(message(name));
        }

        router.replace("/", { scroll: false });
    }, [welcome, router, name]);

    return null;
}
