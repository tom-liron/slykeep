import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { ITEM_TYPE_CATALOG, SYSTEM_ITEM_TYPE_NAMES } from "../src/config/item-type-catalog";
import { normalizeTagName } from "../src/lib/item-schemas";
import type { ItemTypeName } from "../src/types/item-type";
import { PrismaClient } from "../src/generated/prisma-client/client";
import { DEMO_USER, SEED_COLLECTIONS } from "./seed-data";

/**
 * Database seed script, run by Prisma's seed hook (`prisma migrate dev`, `prisma db seed`) and by
 * `npm run db:reset`.
 *
 * Writes the seven system `ItemType` rows from `config/item-type-catalog.ts`, then — unless
 * `--types-only` is passed — the demo user and its collections and items from `seed-data.ts`.
 * `--types-only` is the one mode safe to run against a real deployment: item types are reference
 * data every `Item` points at, while the demo user and its content are development fixtures.
 */

// The seed runs under the CLI, so it uses the same direct connection migrations do.
const connectionString = process.env.DIRECT_URL;

if (!connectionString) {
    throw new Error("DIRECT_URL is not set. Copy .env.example to .env and fill in the Neon URLs.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const PASSWORD_ROUNDS = 12;

/**
 * Seeds the seven system item types. The catalog is the source of truth for their icon and color;
 * this is the only place those flow into the database.
 *
 * Reads then writes rather than upserting: an `upsert` matches on `@@unique([name, userId])`, and
 * system rows have `userId: null` — Postgres treats every NULL as distinct in a unique index, so
 * the match never hits and each run would insert a fresh duplicate set. See the `ItemType` model in
 * `prisma/schema.prisma` for the partial index that backstops this.
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
 * Collections and items have no natural key — their ids are cuids — so there is nothing to match a
 * re-run against, and creating them unconditionally would duplicate every item on every seed.
 * Clearing the demo user's content first makes the seed authoritative: whatever `seed-data.ts` says
 * is what ends up in the database. Cascades take the join rows with them.
 *
 * Scoped to the demo user, so a real user's data is never touched.
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
                    userId,
                    itemTypeId: itemTypeIds[item.type],
                    // Tags are per-account, so the uniqueness this connects on is
                    // `(userId, normalized)` — the seed user's own `react`, never another
                    // account's. `normalized` is what the constraint is on; `name` is the spelling
                    // that gets rendered.
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

/**
 * `--types-only` seeds the system item types and stops. That is the only part of this script that
 * is safe to run against production: item types are reference data (every `Item` carries an
 * `itemTypeId` FK into them), whereas the demo user and its content are development fixtures.
 * `DEMO_USER.password` lives in a committed file, so the demo account must never reach a
 * public deployment.
 */
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
