/**
 * Whether the Pro entitlements actually refuse anyone.
 *
 * Switched on once billing state became authoritative: Stripe checkout, the customer portal, and the
 * webhook that syncs `isPro` are all live, so an account that is not Pro is now a fact about what
 * was paid for rather than an artefact of the integration being unfinished.
 *
 * It gates two different rules, both in `src/lib/limits.ts` — the file and image item types
 * (`canAccessItemType`, read by the sidebar, the item-type pages, the upload route and the item
 * write) and the free tier's counts (`canCreateItem`, `canCreateCollection`). One switch for both,
 * so there is never a release where half the plan is enforced.
 *
 * Turning this off again is a complete rollback: every gate short-circuits to `true` and nothing
 * else in the app reads it. It refuses new writes only — an account already holding two hundred
 * items keeps all two hundred and simply cannot add a two hundred and first.
 */
export const ENFORCE_PRO_LIMITS = true;
