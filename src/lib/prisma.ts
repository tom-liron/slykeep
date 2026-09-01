import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma-client/client";

// Prisma 7 requires a driver adapter — the client no longer opens its own connection. The adapter
// gets Neon's *pooled* URL; the CLI uses the direct one for migrations (see prisma.config.ts).
// Next.js loads .env itself, so no dotenv here.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env and fill in the Neon URLs.",
    );
}

/**
 * The compute endpoint of the production Neon branch, `br-cold-frost-asmwwtlg`.
 *
 * Not a secret — `CLAUDE.md` already names both branch ids — and it is here rather than in an
 * environment variable on purpose: a guard that can be switched off by the same file that
 * misconfigured the connection is not a guard.
 */
const PRODUCTION_DB_ENDPOINT = "ep-winter-sound-as575jke";

/**
 * Refuses to open a connection to production from anywhere that is not the deployment.
 *
 * This exists because of a specific near-miss, and the mechanism is worth stating plainly: `npm
 * start` sets `NODE_ENV=production`, and **Next then loads `.env.production` in preference to
 * `.env`**. That file held the production connection string, so a local production-mode run — the
 * ordinary way to check a build, or a response header, or a route — was silently talking to the
 * live database. Nothing in the command said so. It took a scheduled-deletion endpoint being tested
 * that way, and reporting a row deleted that the same job had just reported zero of against dev,
 * for the difference to surface at all.
 *
 * The file has been renamed to `.env.production.example` so nothing auto-loads it, which fixes
 * that instance. This fixes the class: an exported shell variable, a copied `.env`, or a future file
 * Next decides to read would all arrive here too.
 *
 * `VERCEL` is what distinguishes the deployment, where this connection is the whole point, from a
 * laptop, where it almost never is. `ALLOW_PRODUCTION_DB` is the deliberate override, and it is
 * spelled out rather than omitted so that the answer to "I really do need to look at production" is
 * one obvious variable rather than deleting this function.
 *
 * The Prisma CLI does not import this module, so migrations are unaffected — `db:deploy` against
 * production still works from anywhere, which is what deploys need.
 */
if (
    connectionString.includes(PRODUCTION_DB_ENDPOINT) &&
    !process.env.VERCEL &&
    !process.env.ALLOW_PRODUCTION_DB
) {
    throw new Error(
        "Refusing to connect to the production database from a local run.\n" +
            "DATABASE_URL points at the production Neon branch (br-cold-frost-asmwwtlg).\n" +
            "`npm start` sets NODE_ENV=production, which makes Next prefer a `.env.production` file " +
            "over `.env` — check which file is supplying this value.\n" +
            "Set ALLOW_PRODUCTION_DB=1 if this is genuinely what you want.",
    );
}

function createPrismaClient() {
    return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Dev hot-reload replaces module instances, which would otherwise leak a connection pool per
// reload until Postgres refuses new connections.
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
