import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { SYSTEM_ITEM_TYPE_NAMES } from "../src/config/item-type-catalog";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Database smoke test. Run with `npm run db:test`.
 *
 * Checks the things that are easy to get silently wrong: that both Neon endpoints are reachable,
 * that the migration history is recorded, that the seed produced exactly the seven system types,
 * and that the partial unique index actually rejects a duplicate system type.
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
    // would succeed, and we must not leave that row behind.
    try {
        await prisma.$transaction(async (tx) => {
            await tx.itemType.create({
                data: { name: "snippet", icon: "Code", color: "#3b82f6", isSystem: true },
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
