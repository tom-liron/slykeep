import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ESLint configuration for `npm run lint`: Next's Core Web Vitals and TypeScript presets, plus the
 * rule that keeps `src/lib/` free of server-only imports.
 */

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    // Override default ignores of eslint-config-next.
    globalIgnores([
        // Default ignores of eslint-config-next:
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
        // Prisma Client — generated on install, never edited by hand.
        "src/generated/**",
        // The monaco build, copied out of node_modules by `npm run monaco:sync`. Minified
        // third-party JS, whose findings cannot be acted on here.
        "public/monaco/**",
    ]),
    // `src/lib/` is reachable from client components, so nothing in it may pull in server-only
    // code: `server-only` throws at build time, and `@/server/*` modules all import it. Keeping
    // the folder client-safe is what makes "`@/lib/*` imports anywhere, `@/server/*` does not" a
    // rule with no exceptions — infrastructure clients live in `src/server/infra/` for this reason.
    {
        files: ["src/lib/**"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    paths: [
                        {
                            name: "server-only",
                            message:
                                "src/lib/ is client-reachable. Move this module to src/server/ instead.",
                        },
                    ],
                    patterns: [
                        {
                            group: ["@/server/*", "@/server/**"],
                            message:
                                "src/lib/ is client-reachable and must not import server-only code from src/server/.",
                        },
                    ],
                },
            ],
        },
    },
]);

export default eslintConfig;
