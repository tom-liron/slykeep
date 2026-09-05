import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 moves CLI configuration out of `schema.prisma` and `package.json` into this file:
 * the datasource URL, the migrations directory, and the seed command all live here.
 *
 * The CLI connects with `DIRECT_URL` (Neon's unpooled endpoint) because migrations open a
 * session-level connection that the PgBouncer pooler cannot serve. Prisma Client uses the pooled
 * `DATABASE_URL` instead — see `src/server/infra/prisma.ts`.
 */
export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
        seed: "tsx prisma/seed.ts",
    },
    datasource: {
        url: env("DIRECT_URL"),
    },
});
