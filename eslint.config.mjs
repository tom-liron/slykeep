import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
        // third-party JS: 25,000 findings that are not ours and cannot be acted on.
        "public/monaco/**",
    ]),
]);

export default eslintConfig;
