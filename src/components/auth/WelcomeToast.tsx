"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * The greeting is deliberately not "welcome back": the same destination serves a returning sign-in
 * and the first one a newly registered account ever makes, and nothing at this point distinguishes
 * them. "Welcome" is true of both.
 *
 * It falls back to the impersonal wording when there is no usable name — an account whose `name` was
 * the email address and whose local part came back empty. "Welcome, !" is worse than no name at all.
 */
const MESSAGES = {
    "signed-in": (name: string) => (name ? `Welcome, ${name}!` : "Welcome!"),
} as const;

/**
 * Raises the post-sign-in toast, then strips the flag that triggered it.
 *
 * Mounted only on the dashboard home, this turns `welcome=signed-in` into the post-sign-in toast. It
 * must live at the redirect destination because the sign-in form unmounts before a server redirect
 * completes.
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
