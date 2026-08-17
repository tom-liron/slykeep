/**
 * What a billing Server Action hands back — the failure arm only. The success path is a
 * `redirect()` to Stripe, which throws, so there is no success value for a caller to read.
 *
 * Lives here rather than beside the actions for the reason `types/account.ts` states: a
 * `"use server"` module may only export async functions, so a type declared next to the action
 * that returns it would not be exportable.
 */
export type BillingActionResult = { success: false; error: string };
