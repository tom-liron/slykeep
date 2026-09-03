/**
 * Master switch for free-tier enforcement.
 *
 * Every entitlement rule in `lib/limits.ts` reads this flag: access to the file and image item
 * types, the free tier's item and collection caps, and access to the four AI features. Those rules
 * are consulted in turn by the sidebar, the item-type pages, the upload route and the item,
 * collection and AI write paths, so this constant decides whether the plan gates refuse anyone.
 *
 * @remarks
 * One switch for every rule, so no release enforces half the plan. Setting it to `false`
 * short-circuits every gate to `true`, and nothing else in the application reads it. The gates
 * refuse new writes only — an account already past a cap keeps what it holds and cannot add to it.
 */
export const ENFORCE_PRO_LIMITS = true;
