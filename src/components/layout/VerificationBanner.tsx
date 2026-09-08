"use client";

import { X } from "lucide-react";
import { useSyncExternalStore } from "react";

import { ResendVerification } from "@/components/auth/ResendVerification";
import { Button } from "@/components/ui/button";
import type { UserViewModel } from "@/types/view-models";

/**
 * The standing explanation for why an unconfirmed account cannot save anything.
 *
 * Rendered above every signed-in page by the dashboard layout, and nothing at all once the address
 * is confirmed. It is the second half of a pair: the write paths refuse through `readOnlyRefusal`
 * in `server/access.ts` at the moment somebody tries, and this says the same thing up front so the
 * first refusal is not a surprise.
 *
 * @remarks
 * Dismissible, per browser session, so it returns on the next visit rather than being gone for good.
 * It can afford to be, because it is not the only thing carrying the message — an unconfirmed
 * account meets the refusal on its first write either way, and that is what teaches the rule. A
 * banner nobody can dismiss is only worth its cost when dismissing it would hide the answer to a
 * question the user cannot otherwise reach.
 *
 * `sessionStorage` is the store and {@link useSyncExternalStore} is how it is read: the server has
 * no such thing, so the server snapshot is a flat `false` and React reconciles after hydration
 * without the render and the markup ever disagreeing.
 */
const DISMISSED_KEY = "devstash:verification-banner-dismissed";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
    listeners.add(listener);

    return () => void listeners.delete(listener);
}

/**
 * A browser refusing session storage — private mode, blocked site data — reads as "not dismissed".
 * The banner is the safer default there; it simply cannot be dismissed for the session.
 */
function readDismissed() {
    try {
        return sessionStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
        return false;
    }
}

/**
 * Undoes a dismissal, so the banner is on the page again.
 *
 * Called when a write is refused for want of a confirmed address, because the refusal tells the user
 * to request a new link "from the banner at the top of the page" — and a banner they dismissed
 * earlier in the session would leave that instruction pointing at nothing, with no route back to the
 * resend control until they opened a new tab. Dismissing means "I know, not now"; being refused
 * means they need it now.
 */
export function revealVerificationBanner() {
    try {
        sessionStorage.removeItem(DISMISSED_KEY);
    } catch {
        // Nothing was stored, so nothing is hiding the banner.
    }

    listeners.forEach((listener) => listener());
}

export function VerificationBanner({ user }: { user: UserViewModel }) {
    const dismissed = useSyncExternalStore(subscribe, readDismissed, () => false);

    if (user.emailVerified || dismissed) return null;

    function dismiss() {
        try {
            sessionStorage.setItem(DISMISSED_KEY, "1");
        } catch {
            // Nothing to dismiss to. The banner stays, which is the honest outcome when the browser
            // will not remember the choice anyway.
        }

        listeners.forEach((listener) => listener());
    }

    return (
        <div
            role="status"
            className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm"
        >
            {/* `min-w-0` with `flex-1` is what lets the text take the row and push the controls to
                the far edge, instead of the actions sitting under a half-empty line. */}
            {/* The address is named rather than referred to, because this is the one screen where
                somebody who mistyped it at signup would notice. */}
            <p className="min-w-0 flex-1 text-muted-foreground">
                Confirm <span className="font-medium text-foreground">{user.email}</span> to unlock
                this account. Adding, editing and organizing items and collections are currently
                disabled.
            </p>

            <div className="flex shrink-0 items-center gap-1">
                <ResendVerification defaultEmail={user.email} knownEmail />

                <Button
                    type="button"
                    onClick={dismiss}
                    variant="ghost"
                    size="icon"
                    aria-label="Dismiss until next visit"
                >
                    <X className="size-4" aria-hidden="true" />
                </Button>
            </div>
        </div>
    );
}
