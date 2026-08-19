import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The integration suite: tests that talk to real services rather than to stand-ins.
 *
 * Separate from `vitest.config.ts` because these are a different kind of test with different costs.
 * They need credentials, they take seconds rather than milliseconds, they mutate a real Stripe
 * account and a real database, and they fail when the network does — none of which belongs in the
 * suite that runs on every change. `npm test` excludes them by filename; `npm run billing:test`
 * runs them on purpose.
 *
 * The aliases match the unit config exactly. `server-only` is the one that matters: the modules
 * under test are marked with it, and Node throws on importing that package outside a React Server
 * Component — which is precisely why this could not be an ordinary `scripts/*.ts` file.
 */
export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            "server-only": fileURLToPath(new URL("./vitest.server-only.ts", import.meta.url)),
        },
    },
    test: {
        environment: "node",
        include: ["src/**/*.integration.test.ts"],
        // Real API calls against Stripe, and a subscription lifecycle driven one step at a time.
        testTimeout: 30_000,
        hookTimeout: 30_000,
        // One file, one Stripe account, one row: parallelism here would only race.
        fileParallelism: false,
        // Vitest does not read `.env`; Next does that in the app. Without this the modules under
        // test throw on a missing DATABASE_URL before a single assertion runs.
        setupFiles: ["dotenv/config"],
    },
});
