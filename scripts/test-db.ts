import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { ITEM_TYPE_CATALOG, SYSTEM_ITEM_TYPE_NAMES } from "../src/config/item-type-catalog";
import { PrismaClient } from "../src/generated/prisma-client/client";
import { DEMO_USER, SEED_COLLECTIONS } from "../prisma/seed-data";

/**
 * Database smoke test. Run with `npm run db:test`.
 *
 * Checks the things that are easy to get silently wrong: that both Neon endpoints are reachable,
 * that the migration history is recorded, that the seed produced exactly the seven system types,
 * that the partial unique index actually rejects a duplicate system type, and that the demo content
 * is intact. Then prints the demo data as it is actually stored, so it can be eyeballed rather than
 * taken on trust.
 *
 * Read-only in effect — the one write it attempts is rolled back.
 */

const POOLED_URL = process.env.DATABASE_URL;
const DIRECT_URL = process.env.DIRECT_URL;

let failures = 0;

function pass(message: string) {
    console.log(`  ✓ ${message}`);
}

function fail(message: string) {
    console.error(`  ✗ ${message}`);
    failures += 1;
}

function client(connectionString: string) {
    return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Thrown to roll back the constraint probe; never escapes `checkSystemTypeConstraint`. */
class Rollback extends Error {}

async function checkConnection(label: string, url: string | undefined) {
    if (!url) {
        fail(`${label} is not set — copy .env.example to .env and fill it in`);
        return;
    }

    const prisma = client(url);
    try {
        await prisma.$queryRaw`SELECT 1`;
        const [{ host }] = await prisma.$queryRaw<
            { host: string }[]
        >`SELECT inet_server_addr()::text AS host`;
        pass(`${label} reachable (server ${host ?? "unknown"})`);
    } catch (error) {
        fail(`${label} unreachable — ${(error as Error).message.split("\n")[0]}`);
    } finally {
        await prisma.$disconnect();
    }
}

async function checkMigrations(prisma: PrismaClient) {
    const applied = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`
        SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at
    `;

    if (applied.length === 0) {
        fail("no migrations applied — run `npm run db:migrate`");
        return;
    }

    const unfinished = applied.filter((m) => m.finished_at === null);
    if (unfinished.length > 0) {
        fail(
            `${unfinished.length} migration(s) did not finish: ${unfinished.map((m) => m.migration_name).join(", ")}`,
        );
        return;
    }

    pass(
        `${applied.length} migration(s) applied: ${applied.map((m) => m.migration_name).join(", ")}`,
    );
}

async function checkSystemItemTypes(prisma: PrismaClient) {
    const types = await prisma.itemType.findMany({
        where: { userId: null },
        orderBy: { name: "asc" },
    });

    const found = types.map((t) => t.name).sort();
    const expected = [...SYSTEM_ITEM_TYPE_NAMES].sort();

    if (found.length !== expected.length || found.some((name, i) => name !== expected[i])) {
        fail(
            `system item types are ${found.join(", ") || "(none)"} — expected ${expected.join(", ")}. Run \`npm run db:seed\`.`,
        );
        return;
    }

    const notSystem = types.filter((t) => !t.isSystem);
    if (notSystem.length > 0) {
        fail(`${notSystem.length} unowned item type(s) have isSystem = false`);
        return;
    }

    pass(`${types.length} system item types seeded: ${found.join(", ")}`);
}

async function checkSystemTypeConstraint(prisma: PrismaClient) {
    const indexes = await prisma.$queryRaw<{ indexdef: string }[]>`
        SELECT indexdef FROM pg_indexes
        WHERE tablename = 'item_types' AND indexname = 'item_types_name_system_key'
    `;

    if (indexes.length === 0) {
        fail(
            "partial unique index item_types_name_system_key is missing — system types are unconstrained",
        );
        return;
    }
    pass("partial unique index present: item_types_name_system_key");

    // The index is the only thing stopping a second ('snippet', NULL) row, so prove it bites.
    // Wrapped in a transaction that always rolls back: if the constraint were broken the insert
    // would succeed, and that row must not be left behind.
    try {
        await prisma.$transaction(async (tx) => {
            await tx.itemType.create({
                data: { name: "snippet", icon: "Code", color: "#FF5C5C", isSystem: true },
            });
            throw new Rollback("duplicate system type was accepted");
        });
    } catch (error) {
        if (error instanceof Rollback) {
            fail(
                "a duplicate ('snippet', NULL) was ACCEPTED — the unique constraint does not hold",
            );
            return;
        }

        const code = (error as { code?: string }).code;
        if (code === "P2002") {
            pass("duplicate ('snippet', NULL) rejected with P2002, as intended");
            return;
        }

        fail(`constraint probe failed unexpectedly — ${(error as Error).message.split("\n")[0]}`);
        return;
    }

    fail("constraint probe did not roll back as expected");
}

async function checkDemoUser(prisma: PrismaClient) {
    const user = await prisma.user.findUnique({ where: { email: DEMO_USER.email } });

    if (!user) {
        fail(`demo user ${DEMO_USER.email} is missing — run \`npm run db:seed\``);
        return null;
    }

    if (!user.password || !(await bcrypt.compare(DEMO_USER.password, user.password))) {
        fail("demo user's password does not verify — the hash is wrong or was not written");
    } else {
        pass(`demo user ${user.email} present, password hash verifies`);
    }

    if (!user.emailVerified) {
        fail("demo user has no emailVerified date");
    }

    return user;
}

async function checkDemoContent(prisma: PrismaClient, userId: string) {
    const expectedItems = SEED_COLLECTIONS.reduce((n, c) => n + c.items.length, 0);

    const [collections, items] = await Promise.all([
        prisma.collection.count({ where: { userId } }),
        prisma.item.count({ where: { userId } }),
    ]);

    // A duplicating seed shows up here first: re-running would double these.
    if (collections !== SEED_COLLECTIONS.length || items !== expectedItems) {
        fail(
            `demo content is ${collections} collection(s) / ${items} item(s) — expected ${SEED_COLLECTIONS.length} / ${expectedItems}. A duplicated count means the seed is not idempotent.`,
        );
        return;
    }
    pass(`${collections} collections, ${items} items — counts match the seed exactly`);

    const favorites = await prisma.item.count({ where: { userId, isFavorite: true } });
    const pinned = await prisma.item.count({ where: { userId, isPinned: true } });
    const favoriteCollections = await prisma.collection.count({
        where: { userId, isFavorite: true },
    });
    const tags = await prisma.tag.count();

    // The dashboard renders each of these; all-zero means empty sections and blank stat cards.
    if (favorites === 0 || pinned === 0 || favoriteCollections === 0 || tags === 0) {
        fail(
            `dashboard fields look unseeded — ${favorites} favorite items, ${pinned} pinned, ${favoriteCollections} favorite collections, ${tags} tags`,
        );
    } else {
        pass(
            `dashboard fields populated — ${favorites} favorite items, ${pinned} pinned, ${favoriteCollections} favorite collections, ${tags} tags`,
        );
    }
}

/**
 * `Item.contentType` is denormalized against the item's type, and nothing in the schema enforces
 * that they agree — so a snippet could silently store its body in `url`, or a link could have a
 * null `url` and render as a dead card. Check every item.
 */
async function checkContentIntegrity(prisma: PrismaClient, userId: string) {
    const items = await prisma.item.findMany({
        where: { userId },
        include: { itemType: true },
    });

    const wrong: string[] = [];

    for (const item of items) {
        const expected = ITEM_TYPE_CATALOG[item.itemType.name as keyof typeof ITEM_TYPE_CATALOG];

        if (!expected) {
            wrong.push(`${item.title}: unknown item type "${item.itemType.name}"`);
            continue;
        }

        if (item.contentType !== expected.contentType) {
            wrong.push(
                `${item.title}: contentType ${item.contentType} but type "${item.itemType.name}" is ${expected.contentType}`,
            );
            continue;
        }

        if (item.contentType === "TEXT" && !item.content) {
            wrong.push(`${item.title}: TEXT item has no content`);
        }
        if (item.contentType === "URL" && !item.url) {
            wrong.push(`${item.title}: URL item has no url`);
        }
        if (item.contentType === "URL" && item.content) {
            wrong.push(`${item.title}: URL item also populated content`);
        }
        if (item.contentType === "TEXT" && item.url) {
            wrong.push(`${item.title}: TEXT item also populated url`);
        }
    }

    if (wrong.length > 0) {
        fail(`${wrong.length} item(s) have inconsistent content:`);
        for (const line of wrong) console.error(`      ${line}`);
        return;
    }

    pass(`all ${items.length} items store their body in the column their content type requires`);
}

/** Clips to `width` so the listing stays in columns; keeps the first line only. */
function clip(text: string, width: number) {
    const [firstLine = ""] = text.trim().split("\n");
    return (firstLine.length > width ? `${firstLine.slice(0, width - 1)}…` : firstLine).padEnd(
        width,
    );
}

/**
 * Prints the demo data as the database actually holds it — reading through the ItemCollection join,
 * the item type relation and the tag relation, so what appears here is what a query would return,
 * not a re-print of `seed-data.ts`.
 */
async function printDemoData(prisma: PrismaClient, userId: string) {
    const collections = await prisma.collection.findMany({
        where: { userId },
        orderBy: { name: "asc" },
        include: {
            defaultType: true,
            items: {
                orderBy: { addedAt: "asc" },
                include: { item: { include: { itemType: true, tags: true } } },
            },
        },
    });

    for (const collection of collections) {
        const flag = collection.isFavorite ? " ★" : "";
        console.log(`\n  ${collection.name}${flag} — ${collection.description ?? ""}`);
        console.log(
            `  default type: ${collection.defaultType?.name ?? "none"}   items: ${collection.items.length}`,
        );

        for (const { item } of collection.items) {
            const marks = [item.isFavorite ? "★" : " ", item.isPinned ? "📌" : "  "].join("");
            // A FILE item's body is an R2 object, so the column holds a key nobody can read at a
            // glance — its filename is the useful thing to print.
            const body = item.content ?? item.url ?? item.fileName ?? "";
            const tags = item.tags.map((t) => t.name).join(", ");

            console.log(
                `    ${marks} ${item.itemType.name.padEnd(8)} ${clip(item.title, 34)} ${clip(body, 46)} [${tags}]`,
            );
        }
    }

    console.log("\n  ★ favorite   📌 pinned");
}

async function main() {
    console.log("\nConnections");
    await checkConnection("DATABASE_URL (pooled, used by the app)", POOLED_URL);
    await checkConnection("DIRECT_URL (unpooled, used by the CLI)", DIRECT_URL);

    if (!POOLED_URL) {
        return;
    }

    const prisma = client(POOLED_URL);
    try {
        console.log("\nSchema");
        await checkMigrations(prisma);

        console.log("\nSeed");
        await checkSystemItemTypes(prisma);

        console.log("\nSystem-type uniqueness");
        await checkSystemTypeConstraint(prisma);

        console.log("\nDemo data");
        const user = await checkDemoUser(prisma);
        if (user) {
            await checkDemoContent(prisma, user.id);
            await checkContentIntegrity(prisma, user.id);

            console.log("\nSeeded content");
            await printDemoData(prisma, user.id);
        }
    } finally {
        await prisma.$disconnect();
    }
}

main()
    .catch((error) => {
        console.error(error);
        failures += 1;
    })
    .finally(() => {
        if (failures > 0) {
            console.error(`\n${failures} check(s) failed.\n`);
            process.exit(1);
        }
        console.log("\nAll checks passed.\n");
    });
