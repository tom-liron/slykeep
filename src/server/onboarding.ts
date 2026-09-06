import "server-only";

import { ITEM_TYPE_CATALOG } from "@/config/item-type-catalog";
import {
    STARTER_COLLECTIONS,
    STARTER_UNFILED_ITEMS,
    uniqueTags,
    type StarterItem,
} from "@/config/starter-content";
import { normalizeTagName } from "@/lib/item-schemas";
import { prisma } from "@/server/infra/prisma";

/**
 * First-run content for a newly created account.
 *
 * Both sign-up paths call {@link seedStarterContent} the moment an account exists — the credentials
 * route `api/auth/register`, and the `linkAccount` event in `src/auth.ts` for GitHub — so the first
 * dashboard a visitor sees has collections, items, tags, a pin and a favourite in it rather than
 * five empty sections. The records are the fixtures in `config/starter-content.ts`; this module is
 * only the writer that turns them into rows.
 *
 * @remarks
 * Seeding is best-effort and must never fail a registration: the account is the thing being created,
 * and demo content is decoration on top of it. Callers catch and log rather than propagate.
 */

/** Spacing between consecutive seeded items' timestamps. */
const TIMESTAMP_STEP_MS = 60_000;

/**
 * Writes the starter collections and items into an empty account.
 *
 * Does nothing when the account already holds content, so a second call — a GitHub account linked
 * to an existing user, a retried registration — cannot duplicate the fixtures.
 *
 * @throws When the database is unreachable or a write is rejected. Registration paths catch this;
 * an account without demo content is a working account.
 */
export async function seedStarterContent(userId: string): Promise<void> {
    const [items, collections] = await Promise.all([
        prisma.item.count({ where: { userId } }),
        prisma.collection.count({ where: { userId } }),
    ]);

    if (items > 0 || collections > 0) return;

    // System types are the seeded rows with no owner. Read as a map rather than one lookup per
    // item, and missing names are skipped below: a database whose system types were never seeded
    // should leave the account empty, not throw during sign-up.
    const typeRows = await prisma.itemType.findMany({
        where: { userId: null },
        select: { id: true, name: true },
    });
    const itemTypeIdByName = new Map(typeRows.map((row) => [row.name, row.id]));

    const filed = STARTER_COLLECTIONS.flatMap((collection) =>
        collection.items.map((item) => ({ item, collectionName: collection.name })),
    );
    const all = [
        ...filed,
        ...STARTER_UNFILED_ITEMS.map((item) => ({ item, collectionName: null })),
    ];

    // Tags first, in one statement, so the item writes below can `connect` an existing row. Created
    // per item with `connectOrCreate` instead, the writes could not run in parallel: two items
    // sharing a tag would race for the same `(userId, normalized)` row.
    await prisma.tag.createMany({
        data: uniqueTags(all.map(({ item }) => item)).map((name) => ({
            name,
            normalized: normalizeTagName(name),
            userId,
        })),
        skipDuplicates: true,
    });

    const collectionIdByName = new Map<string, string>();

    for (const seed of STARTER_COLLECTIONS) {
        const collection = await prisma.collection.create({
            data: {
                name: seed.name,
                description: seed.description,
                isFavorite: seed.isFavorite ?? false,
                userId,
                defaultTypeId: itemTypeIdByName.get(seed.defaultType) ?? null,
            },
            select: { id: true },
        });
        collectionIdByName.set(seed.name, collection.id);
    }

    // Timestamps descend from now in fixture order, so every recency listing — the dashboard's
    // recent items, a type page, a collection — opens on a stable order rather than on whatever
    // the database returns for eighteen rows written in the same millisecond.
    const base = Date.now();

    await Promise.all(
        all.map(({ item, collectionName }, index) => {
            const itemTypeId = itemTypeIdByName.get(item.type);
            if (!itemTypeId) return undefined;

            const collectionId = collectionName
                ? collectionIdByName.get(collectionName)
                : undefined;
            const timestamp = new Date(base - index * TIMESTAMP_STEP_MS);

            return prisma.item.create({
                data: {
                    ...itemContent(item),
                    title: item.title,
                    description: item.description,
                    language: item.language ?? null,
                    isFavorite: item.isFavorite ?? false,
                    isPinned: item.isPinned ?? false,
                    // Null exactly when the item is not pinned — the write-boundary rule the
                    // dashboard's Pinned section orders by.
                    pinnedAt: item.isPinned ? timestamp : null,
                    createdAt: timestamp,
                    editedAt: timestamp,
                    userId,
                    itemTypeId,
                    tags: {
                        connect: item.tags.map((name) => ({
                            userId_normalized: { userId, normalized: normalizeTagName(name) },
                        })),
                    },
                    collections: collectionId ? { create: { collectionId } } : undefined,
                },
                select: { id: true },
            });
        }),
    );
}

/**
 * Routes a fixture's `body` to the column its item type stores content in, and derives
 * `contentType` from the same place.
 *
 * @remarks
 * Derived rather than written into the fixtures: a snippet is always `TEXT` and a link always
 * `URL`, so a body cannot land in the wrong column. The schema does not enforce this.
 */
function itemContent(item: StarterItem) {
    const { contentType } = ITEM_TYPE_CATALOG[item.type];

    return {
        contentType,
        content: contentType === "TEXT" ? item.body : null,
        url: contentType === "URL" ? item.body : null,
    };
}
