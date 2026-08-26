import { ENFORCE_PRO_LIMITS } from "@/config/access";

/**
 * Centralizes item-type entitlement checks until billing rules become more detailed.
 * `ENFORCE_PRO_LIMITS` is on, so this refuses for real; turning it off reopens every type.
 */
export function canAccessItemType(userIsPro: boolean, itemTypeIsPro: boolean): boolean {
    return !ENFORCE_PRO_LIMITS || userIsPro || !itemTypeIsPro;
}

/** What a free account may hold, per `project-overview.md` §7. */
export const FREE_ITEM_LIMIT = 50;
export const FREE_COLLECTION_LIMIT = 3;

/**
 * Whether one more item may be created.
 *
 * Takes the current count rather than querying it, which is what keeps this a pure function — the
 * same shape `canAccessItemType` has, and the reason both are testable without a database. The
 * `count()` belongs at the call site, which already has the user resolved.
 *
 * `<` rather than `<=`: the argument is how many exist *now*, so at 50 the next one would be the
 * 51st and is refused.
 */
export function canCreateItem(userIsPro: boolean, currentCount: number): boolean {
    return !ENFORCE_PRO_LIMITS || userIsPro || currentCount < FREE_ITEM_LIMIT;
}

/** The same rule for collections. */
export function canCreateCollection(userIsPro: boolean, currentCount: number): boolean {
    return !ENFORCE_PRO_LIMITS || userIsPro || currentCount < FREE_COLLECTION_LIMIT;
}

/**
 * Whether this account may use the AI features — auto-tagging today, the rest of §4.F after it.
 *
 * Here rather than inlined in the action, so it reads `ENFORCE_PRO_LIMITS` like every other
 * entitlement does. That flag is documented as a complete rollback, and a hand-written
 * `if (!isPro)` in the action would be the one gate it could not switch off.
 *
 * One rule for all four AI features rather than one each: they are sold as a single line on the
 * pricing page, so a per-feature entitlement would be inventing a plan we do not offer.
 */
export function canUseAi(userIsPro: boolean): boolean {
    return !ENFORCE_PRO_LIMITS || userIsPro;
}
