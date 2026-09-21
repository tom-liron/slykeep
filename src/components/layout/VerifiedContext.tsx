"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Whether the signed-in account's email address is confirmed, for the controls that render
 * differently until it is.
 *
 * An unconfirmed account is refused every write by `readOnlyRefusal` in `server/access.ts`. This is
 * how the UI knows to disable those controls up front instead of letting each one fail on click.
 * A context rather than a prop for the same reason as `ProProvider` in `./ProContext`: the deepest
 * consumers — the item drawer's toolbar, the collection row menus — mount far below the layout that
 * reads the user.
 */

/**
 * The account's verified state as the provider sets it.
 *
 * @remarks
 * Defaults to `true`, failing *open*, unlike `ProContext`. A missing provider would otherwise
 * disable every write control in the application, and the Server Action refuses regardless, so the
 * action stays the authority.
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
 * The content controls use this; the checkout buttons do not. Content controls sit several to a
 * toolbar, where the banner already explains them. Checkout is a single, intentional click on
 * `/upgrade`, so it stays live and lets `startCheckout`'s refusal explain itself as a toast — a
 * disabled button there would do nothing and show no tooltip on touch.
 */
export function useWriteBlockedReason(): string | null {
    return useContext(VerifiedContext) ? null : "Confirm your email address to enable this.";
}
