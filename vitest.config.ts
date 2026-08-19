import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            "server-only": fileURLToPath(new URL("./vitest.server-only.ts", import.meta.url)),
        },
    },
    test: {
        environment: "node",
        // The integration suite is a separate command (`npm run billing:test`) with its own config:
        // it needs credentials, talks to real Stripe, and mutates a real database. Excluded here so
        // `npm test` stays offline, fast, and safe to run on every change.
        exclude: ["**/node_modules/**", "**/dist/**", "src/**/*.integration.test.ts"],
    },
});
