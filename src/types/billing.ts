/**
 * The result contract for the billing Server Actions — the failure arm alone.
 *
 * `startCheckout` and `openBillingPortal` in `actions/billing.ts` end in a `redirect()` to Stripe,
 * which throws rather than returning, so success never reaches the caller and there is no success
 * arm to declare. The buttons on `/upgrade` and the settings billing panel render what comes back
 * only when the redirect did not happen.
 *
 * It lives here rather than beside the actions because a `"use server"` module may export only
 * async functions.
 */
export type BillingActionResult = { success: false; error: string };
