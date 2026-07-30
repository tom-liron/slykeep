"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Greeting falls back to the impersonal wording when there is no usable name — an account whose
 * `name` was the email address and whose local part came back empty. "Welcome back, !" is worse
 * than no name at all.
 */
const MESSAGES = {
    back: (name: string) => (name ? `Welcome back, ${name}!` : "Welcome back!"),
} as const;

/**
 * Raises the post-sign-in toast, then strips the flag that triggered it.
 *
 * It has to live on the destination rather than in the form: sign-in redirects from the server, so
 * the form is unmounted before any success handler could run.
 *
 * Clearing the param with `replace` matters — otherwise the toast fires again on every refresh,
 * and the URL stays littered with a flag that means nothing after the first render.
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
