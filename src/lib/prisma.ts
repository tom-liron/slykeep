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
