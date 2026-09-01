import "server-only";

import { cache } from "react";

import { SYSTEM_ITEM_TYPE_NAMES } from "@/config/item-type-catalog";
import { prisma } from "@/lib/prisma";
import type {
    ItemTypeCountViewModel,
    ItemTypeViewModel,
    SidebarNavViewModel,
    UserViewModel,
} from "@/types/view-models";
import { getCurrentUser } from "./current-user";
import { toItemTypeViewModel } from "./view-models";

/**
 * The item types a user can see: the system types (`userId: null`) plus any custom types they own.
 * Returned as a map because callers resolve types by the foreign key on an item or collection.
 */
/**
 * The four columns an `ItemTypeViewModel` is built from, and the only ones any caller reads.
 *
 * Written out at three call sites across two modules before this. The list is not obvious — the
 * plural label, the route slug, the content type and the Pro flag are all *configuration* rather
 * than columns (`project-overview.md` §5) — so a fourth copy is as likely to select too much as too
 * little.
 */
export const ITEM_TYPE_SELECT = { id: true, name: true, icon: true, color: true } as const;

/**
 * The **system** item type with this name, or null.
 *
 * Never `findUnique` by name. A Prisma bug leaks `name` into `ItemTypeWhereUniqueInput` because of
 * the partial index, so it type-checks — but `name` is unique only among system rows, and a user's
 * custom type may share it. `CLAUDE.md` and `prisma/schema.prisma` both record this; the point of
 * the function is that the rule is now obeyed in one place rather than remembered at each.
 */
export function findSystemItemType(name: string) {
    return prisma.itemType.findFirst({
        where: { name, userId: null },
        select: ITEM_TYPE_SELECT,
    });
}

export const getItemTypesById = cache(
    async (userId: string): Promise<ReadonlyMap<string, ItemTypeViewModel>> => {
        const rows = await prisma.itemType.findMany({
            where: { OR: [{ userId: null }, { userId }] },
            select: ITEM_TYPE_SELECT,
        });

        return new Map(
            rows.map((row) => {
                const itemType = toItemTypeViewModel(row);
                return [itemType.id, itemType];
            }),
        );
    },
);

/**
 * Every system item type, in catalog order, each with a live item count. Custom types are
 * intentionally excluded — both callers list system types only.
 *
 * Deliberately *not* filtered by entitlement: a Pro-gated type stays in the list, carrying `isPro`
 * so its caller can mark it. What a locked type does when opened is the page's business, not this
 * query's.
 *
 * One `groupBy` rather than a count per type, and the `?? 0` is what keeps a type the user has no
 * items of in the list: `groupBy` returns no row for an empty group, so the zero has to come from
 * the catalog side of the join. Shared by the sidebar nav and the profile page's breakdown.
 */
export async function getItemTypeCounts(user: UserViewModel): Promise<ItemTypeCountViewModel[]> {
    const [typeRows, counts] = await Promise.all([
        prisma.itemType.findMany({
            // System rows only, which is what the doc comment above already promises. Reading the
            // user's custom types too and then keying them by `name` below would let a custom type
            // sharing a system name overwrite it in the map — the same hazard as a `findUnique` on
            // `name` alone, which `CLAUDE.md` and the partial index in `schema.prisma` both warn
            // about: `name` is unique only among system rows.
            where: { userId: null },
            select: ITEM_TYPE_SELECT,
        }),
        prisma.item.groupBy({
            by: ["itemTypeId"],
            where: { userId: user.id },
            _count: { _all: true },
        }),
    ]);

    const countByTypeId = new Map(counts.map((row) => [row.itemTypeId, row._count._all]));
    const rowByName = new Map(typeRows.map((row) => [row.name, row]));

    // Every system type, including the ones this account cannot open. Hiding the Pro types was the
    // earlier behaviour and it made the product worse at the one moment it matters: a free user
    // never learns that files and images exist, so nothing ever prompts an upgrade. They are listed
    // with a PRO badge instead, and the page behind them explains itself (`ProTypeUpgrade`).
    //
    // Nothing is leaked by listing them — the labels are on the public pricing page, and the count
    // beside a locked type is this user's own, which is zero until they subscribe.
    return SYSTEM_ITEM_TYPE_NAMES.flatMap((name) => {
        const row = rowByName.get(name);
        return row ? [toItemTypeViewModel(row)] : [];
    }).map((itemType) => ({
        id: itemType.id,
        label: itemType.label,
        icon: itemType.icon,
        color: itemType.color,
        slug: itemType.slug,
        itemCount: countByTypeId.get(itemType.id) ?? 0,
        isPro: itemType.isPro,
    }));
}

/** The sidebar nav: the accessible system item types with their counts, plus the signed-in user. */
export async function getSidebarNav(): Promise<SidebarNavViewModel> {
    const user = await getCurrentUser();

    return { itemTypes: await getItemTypeCounts(user), user };
}
