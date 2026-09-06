import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { ITEM_TYPE_CATALOG, SYSTEM_ITEM_TYPE_NAMES } from "../src/config/item-type-catalog";
import { normalizeTagName } from "../src/lib/item-schemas";
import type { ItemTypeName } from "../src/types/item-type";
import { PrismaClient } from "../src/generated/prisma-client/client";
import { DEMO_USER, SEED_COLLECTIONS } from "./seed-data";

/**
 * Prisma seed entry point for system item types and development demo content.
 *
 * Prisma's seed hook and `npm run db:reset` run this script. It synchronizes the catalog-backed
 * system types, then creates the fixtures in `seed-data.ts` unless `--types-only` is supplied.
 *
 * @remarks
 * `--types-only` omits demo content but still writes reference data; it is not a production-access
 * override.
 */

// The seed runs under the CLI, so it uses the same direct connection migrations do.
const connectionString = process.env.DIRECT_URL;

if (!connectionString) {
    throw new Error("DIRECT_URL is not set. Copy .env.example to .env and fill in the Neon URLs.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const PASSWORD_ROUNDS = 12;

/**
 * Synchronizes system item types from the catalog and returns their database IDs.
 *
 * System rows use `userId: null`, so this reads each row before updating or creating it. An upsert
 * cannot reliably target the nullable system-type key; the schema's partial index prevents duplicate
 * catalog names.
 */
async function seedSystemItemTypes(): Promise<Record<ItemTypeName, string>> {
    const ids = {} as Record<ItemTypeName, string>;

    for (const name of SYSTEM_ITEM_TYPE_NAMES) {
        const { icon, color } = ITEM_TYPE_CATALOG[name];
        const existing = await prisma.itemType.findFirst({ where: { name, userId: null } });

        const row = existing
            ? await prisma.itemType.update({
                  where: { id: existing.id },
                  data: { icon, color, isSystem: true },
              })
            : await prisma.itemType.create({ data: { name, icon, color, isSystem: true } });

        ids[name] = row.id;
    }

    return ids;
}

/** Email is a real unique key, so the demo user can be upserted safely. */
async function seedDemoUser() {
    const password = await bcrypt.hash(DEMO_USER.password, PASSWORD_ROUNDS);
    const fields = {
        name: DEMO_USER.name,
        password,
        isPro: DEMO_USER.isPro,
        emailVerified: new Date(),
    };

    return prisma.user.upsert({
        where: { email: DEMO_USER.email },
        update: fields,
        create: { email: DEMO_USER.email, ...fields },
    });
}

/**
 * Removes the demo user's existing fixtures before they are recreated from `seed-data.ts`.
 *
 * Collections and items have no natural key for an upsert, so replacement keeps repeatable seeds
 * aligned with the fixture definitions. The delete is scoped to the demo user.
 */
async function clearDemoContent(userId: string) {
    const { count: items } = await prisma.item.deleteMany({ where: { userId } });
    const { count: collections } = await prisma.collection.deleteMany({ where: { userId } });
    return { items, collections };
}

async function seedCollections(userId: string, itemTypeIds: Record<ItemTypeName, string>) {
    let itemCount = 0;

    for (const seed of SEED_COLLECTIONS) {
        const collection = await prisma.collection.create({
            data: {
                name: seed.name,
                description: seed.description,
                isFavorite: seed.isFavorite ?? false,
                userId,
                defaultTypeId: itemTypeIds[seed.defaultType],
            },
        });

        for (const item of seed.items) {
            // Derived, never hand-written: an item's content type follows from its item type, so
            // the body cannot land in the wrong column. The schema does not enforce this.
            const { contentType } = ITEM_TYPE_CATALOG[item.type];

            await prisma.item.create({
                data: {
                    title: item.title,
                    description: item.description,
                    contentType,
                    content: contentType === "TEXT" ? item.body : null,
                    url: contentType === "URL" ? item.body : null,
                    language: item.language ?? null,
                    isFavorite: item.isFavorite ?? false,
                    isPinned: item.isPinned ?? false,
                    // Null exactly when the item is not pinned: the dashboard's Pinned section
                    // filters on `isPinned` and orders by this, so a pinned row without it sorts
                    // by nothing.
                    pinnedAt: item.isPinned ? new Date() : null,
                    userId,
                    itemTypeId: itemTypeIds[item.type],
                    // Tags are unique per account by `(userId, normalized)`; `name` keeps display
                    // spelling.
                    tags: {
                        connectOrCreate: item.tags.map((name) => ({
                            where: {
                                userId_normalized: {
                                    userId,
                                    normalized: normalizeTagName(name),
                                },
                            },
                            create: { name, normalized: normalizeTagName(name), userId },
                        })),
                    },
                    collections: { create: { collectionId: collection.id } },
                },
            });
            itemCount += 1;
        }
    }

    return { collections: SEED_COLLECTIONS.length, items: itemCount };
}

/** Enables catalog-only seeding and leaves development fixtures untouched. */
const typesOnly = process.argv.includes("--types-only");

async function main() {
    const itemTypeIds = await seedSystemItemTypes();
    console.log(`System item types: ${SYSTEM_ITEM_TYPE_NAMES.length}`);

    if (typesOnly) {
        console.log("Types only:        skipped demo user, collections, and items");
        return;
    }

    const user = await seedDemoUser();
    console.log(`Demo user:         ${user.email}`);

    const cleared = await clearDemoContent(user.id);
    if (cleared.items > 0 || cleared.collections > 0) {
        console.log(
            `Cleared:           ${cleared.collections} collection(s), ${cleared.items} item(s)`,
        );
    }

    const seeded = await seedCollections(user.id, itemTypeIds);
    console.log(`Seeded:            ${seeded.collections} collections, ${seeded.items} items`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
