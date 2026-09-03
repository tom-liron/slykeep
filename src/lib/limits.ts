import { ENFORCE_PRO_LIMITS } from "@/config/access";

/**
 * The free-tier entitlement rules, as pure predicates.
 *
 * Every limit in `project-overview.md` §7 is decided here: which item types need Pro, and the
 * 50-item / 3-collection / AI-features caps on a free account. The Server Actions in
 * `actions/items.ts`, `actions/collections.ts` and `actions/ai.ts` — plus `POST /api/upload` — call
 * these at the write boundary, passing a count they have already queried, so the checks stay
 * testable without a database. {@link ENFORCE_PRO_LIMITS} from `config/access.ts` is the master
 * switch: while it is off every predicate returns `true`.
 *
 * @remarks
 * The UI may show a cap — a disabled control, a usage row — but the action is the authority, the
 * same division `Item.contentType` follows.
 */

/** Whether an account may create or open items of a Pro-gated type (`file`, `image`). */
export function canAccessItemType(userIsPro: boolean, itemTypeIsPro: boolean): boolean {
    return !ENFORCE_PRO_LIMITS || userIsPro || !itemTypeIsPro;
}

/** The free-account ceilings from `project-overview.md` §7. */
export const FREE_ITEM_LIMIT = 50;
export const FREE_COLLECTION_LIMIT = 3;

/**
 * Whether one more item may be created, given how many the account holds now.
 *
 * Takes the current count rather than querying it, which keeps it a pure function; the `count()`
 * belongs at the call site, which has the user resolved already. The comparison is `<`, not `<=`:
 * the argument is the count now, so at {@link FREE_ITEM_LIMIT} the next item would be the 51st and
 * is refused.
 */
export function canCreateItem(userIsPro: boolean, currentCount: number): boolean {
    return !ENFORCE_PRO_LIMITS || userIsPro || currentCount < FREE_ITEM_LIMIT;
}

/** The same rule against {@link FREE_COLLECTION_LIMIT}. */
export function canCreateCollection(userIsPro: boolean, currentCount: number): boolean {
    return !ENFORCE_PRO_LIMITS || userIsPro || currentCount < FREE_COLLECTION_LIMIT;
}

/**
 * Whether the account may use the AI features.
 *
 * One predicate covers all four — auto-tag, describe, explain, optimize — because they are sold as a
 * single line on the pricing page, so a per-feature entitlement would invent a plan that is not
 * offered. Kept here, reading {@link ENFORCE_PRO_LIMITS}, rather than inlined as `if (!isPro)` in
 * the action: that flag is a complete rollback, and an inline check would be the one gate it could
 * not switch off.
 */
export function canUseAi(userIsPro: boolean): boolean {
    return !ENFORCE_PRO_LIMITS || userIsPro;
}
