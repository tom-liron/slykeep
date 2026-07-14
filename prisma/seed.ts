import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { ITEM_TYPE_CATALOG, SYSTEM_ITEM_TYPE_NAMES } from "../src/config/item-type-catalog";
import { PrismaClient } from "../src/generated/prisma/client";

// The seed runs under the CLI, so it uses the same direct connection migrations do.
const connectionString = process.env.DIRECT_URL;

if (!connectionString) {
    throw new Error("DIRECT_URL is not set. Copy .env.example to .env and fill in the Neon URLs.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/**
 * Seeds the seven system item types. The catalog is the source of truth for their icon and color;
 * this is the only place those flow into the database.
 *
 * Deliberately not an `upsert`: upsert would have to match on `@@unique([name, userId])`, and for
 * system types `userId` is NULL — which Postgres treats as distinct from every other NULL, so the
 * match never hits and every run inserts a fresh duplicate set. Reading first and updating by `id`
 * sidesteps that. The partial unique index in the `init` migration is the backstop.
 */
async function main() {
    let created = 0;
    let updated = 0;

    for (const name of SYSTEM_ITEM_TYPE_NAMES) {
        const { icon, color } = ITEM_TYPE_CATALOG[name];
        const existing = await prisma.itemType.findFirst({ where: { name, userId: null } });

        if (existing) {
            await prisma.itemType.update({
                where: { id: existing.id },
                data: { icon, color, isSystem: true },
            });
            updated += 1;
        } else {
            await prisma.itemType.create({
                data: { name, icon, color, isSystem: true },
            });
            created += 1;
        }
    }

    console.log(`Seeded system item types — ${created} created, ${updated} updated.`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
