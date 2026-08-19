import "dotenv/config";

import { createInterface } from "node:readline/promises";

import { PrismaPg } from "@prisma/adapter-pg";

import { DEMO_USER } from "../prisma/seed-data";
import { PrismaClient } from "../src/generated/prisma-client/client";

/**
 * Deletes every account except the demo user. Run with `npm run db:reset`, which follows it with
 * `prisma db seed` so the demo account comes back with the content `seed-data.ts` describes.
 *
 * What this is for: a development database accumulates half-finished test accounts — one per
 * registration flow tried, one per OAuth path, one left mid-verification — and each carries items
 * and collections that make "what does a new account see?" impossible to answer. Emptying it back to
 * one known account is how that question gets an answer again.
 *
 * Deliberately does **not** delete the demo user and re-create it. The seed upserts that row on
 * email, so deleting it first would only churn its id for no gain — and the id is what any session
 * still open is holding.
 *
 * Guarded the way `verify-user.ts` is, and for a stronger reason: that script escalates one account,
 * this one destroys every account it is pointed at. `NODE_ENV` is not the guard — the risk lives in
 * `DATABASE_URL`, and running locally with production credentials in `.env` sails straight past any
 * environment check. So the target host is printed and confirmed interactively; `--yes` skips the
 * prompt for repeated local use.
 *
 * Everything owned by a deleted account goes with it through `onDelete: Cascade` — items,
 * collections, join rows, sessions, and OAuth accounts. Tags are global and have no owner, so they
 * are left behind, exactly as `deleteAccount` leaves them.
 */

if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    console.error("Refusing to run: this script must never execute in a production environment.");
    process.exit(1);
}

const skipPrompt = process.argv.includes("--yes");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env and fill in the Neon URLs.");
    process.exit(1);
}

/** Host only — the connection string carries the password, which must never reach a terminal. */
function targetHost(url: string) {
    try {
        return new URL(url).host;
    } catch {
        return "(unparseable DATABASE_URL)";
    }
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/**
 * Shows exactly which accounts are about to be destroyed, and on which host, then waits for
 * agreement. The list is read before the prompt rather than after it on purpose: "delete 2 accounts"
 * is not something anyone can meaningfully consent to, and one of them is usually the one the person
 * running this is signed in as.
 */
async function confirm(doomed: { email: string; items: number; collections: number }[]) {
    if (skipPrompt) return true;

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
        `\nAbout to permanently delete ${doomed.length} account(s) on:\n  ${targetHost(connectionString!)}\n\n` +
            doomed
                .map((u) => `  ✗ ${u.email} — ${u.items} item(s), ${u.collections} collection(s)`)
                .join("\n") +
            `\n\n  ✓ ${DEMO_USER.email} is kept and reseeded.\n\nIs that the development database? [y/N] `,
    );

    rl.close();

    return answer.trim().toLowerCase() === "y";
}

async function main() {
    const users = await prisma.user.findMany({
        where: { email: { not: DEMO_USER.email } },
        select: { email: true, _count: { select: { items: true, collections: true } } },
        orderBy: { createdAt: "asc" },
    });

    const doomed = users.map((user) => ({
        email: user.email,
        items: user._count.items,
        collections: user._count.collections,
    }));

    if (doomed.length === 0) {
        console.log(`Only ${DEMO_USER.email} exists. Nothing to delete.`);
        return;
    }

    if (!(await confirm(doomed))) {
        console.log("Aborted. Nothing was deleted.");
        // Non-zero so the `&&` in `db:reset` stops here rather than seeding over a database the
        // person just declined to touch.
        process.exit(1);
    }

    const { count } = await prisma.user.deleteMany({ where: { email: { not: DEMO_USER.email } } });

    for (const user of doomed) console.log(`✗ Deleted ${user.email}`);

    console.log(`\n${count} account(s) deleted. ${DEMO_USER.email} kept.`);
    console.log(
        "Any session held by a deleted account is now dead — sign in again as the demo user.",
    );
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
