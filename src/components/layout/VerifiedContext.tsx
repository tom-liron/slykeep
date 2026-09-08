"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Whether the signed-in account's email address is confirmed, for the controls that render
 * differently until it is.
 *
 * An unconfirmed account is refused every write by `readOnlyRefusal` in `server/access.ts`. This is
 * how the UI knows to disable those controls up front instead of letting each one fail on click.
 * A context rather than a prop for the same reason as `ProProvider` in `./ProContext`: the deepest
 * consumers —
 * the item drawer's toolbar, the collection row menus — mount far below the layout that reads the
 * user.
 *
 * @remarks
 * The default is `true`, which fails *open* — the opposite of `ProContext`'s default and deliberate.
 * A missing provider here would otherwise disable every write control in the application, and the
 * Server Action refuses anyway, so the safe failure is to show the control and let the action be the
 * authority.
 */
const VerifiedContext = createContext(true);

/** Wraps the dashboard tree so {@link useWriteBlockedReason} can read the account's standing. */
export function VerifiedProvider({
    emailVerified,
    children,
}: {
    emailVerified: boolean;
    children: ReactNode;
}) {
    return <VerifiedContext.Provider value={emailVerified}>{children}</VerifiedContext.Provider>;
}

/**
 * Why a write control is disabled, or `null` when it is not.
 *
 * @returns A sentence for a `title` attribute, so hovering a dead control says what would revive it.
 * Returning the reason rather than a boolean is what keeps the wording in one place; every call site
 * reads `disabled={Boolean(reason)}` and `title={reason ?? undefined}`.
 *
 * @remarks
 * The content controls use this; the checkout buttons deliberately do not. Disabling suits an action
 * the banner already accounts for and that sits among several others — four dead toasts in one
 * drawer toolbar is noise. Checkout is the opposite: a deliberate, infrequent click by someone who
 * navigated to `/upgrade` on purpose, where a control that does nothing and has no tooltip on touch
 * is the worst available answer. Those stay live and let `startCheckout`'s refusal surface as a
 * toast.
 */
export function useWriteBlockedReason(): string | null {
    return useContext(VerifiedContext) ? null : "Confirm your email address to enable this.";
}
