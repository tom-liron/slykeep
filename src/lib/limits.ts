import { ENFORCE_PRO_LIMITS } from "@/config/access";

/**
 * Centralizes item-type entitlement checks until billing rules become more detailed.
 * Development keeps all types available while `ENFORCE_PRO_LIMITS` is false.
 */
export function canAccessItemType(userIsPro: boolean, itemTypeIsPro: boolean): boolean {
    return !ENFORCE_PRO_LIMITS || userIsPro || !itemTypeIsPro;
}
