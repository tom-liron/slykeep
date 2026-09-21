import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma-client/client";

/**
 * The shared Prisma client, and the guard that keeps a local run off the production database.
 *
 * Every server-side read and write reaches Postgres through the {@link prisma} export. Prisma 7
 * requires a driver adapter to open connections, so this wires `PrismaPg` to Neon's pooled URL;
 * the CLI uses the direct URL for migrations (see `prisma.config.ts`). Next.js loads `.env`
 * itself, so there is no dotenv call here.
 *
 * @remarks
 * `import "server-only"` so a database connection string can never reach a browser bundle; every
 * module in `server/infra/` carries the directive. Importing this module requires `DATABASE_URL`;
 * unlike the lazy integration clients, it validates that configuration during module evaluation.
 */

/** Neon's pooled connection URL, from `.env`. The adapter opens no connection without it. */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env and fill in the Neon URLs.",
    );
}

/**
 * The compute endpoint of the production Neon branch, `br-cold-frost-asmwwtlg`.
 *
 * Not a secret — `CLAUDE.md` names both branch ids — and held in the source rather than an
 * environment variable: a guard the same misconfigured file could switch off is not a guard.
 */
const PRODUCTION_DB_ENDPOINT = "ep-winter-sound-as575jke";

/**
 * Refuses a connection to the production branch from anywhere that is not the Vercel deployment.
 *
 * @remarks
 * `npm start` sets `NODE_ENV=production`, and Next then loads `.env.production` in preference to
 * `.env`. A local production-mode run — checking a build, a response header, a route — can reach
 * whatever database that file names without the command saying so. This blocks the class: an
 * exported shell variable, a copied `.env`, or a future file Next decides to read all arrive here.
 * `VERCEL` marks the deployment, where the connection is expected; `ALLOW_PRODUCTION_DB` is the
 * explicit override. The Prisma CLI does not import this module, so `db:deploy` against production
 * still works.
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

/** The Prisma client every server module shares. Reused across hot reloads in development. */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
