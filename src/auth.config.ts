import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";

/**
 * The edge-safe half of the auth configuration: providers and nothing else.
 *
 * `src/proxy.ts` runs on the edge runtime and imports *this* file, never `auth.ts`. The Prisma
 * client is generated with `runtime = "nodejs"` and `src/lib/prisma.ts` is marked `server-only`, so
 * pulling the adapter into the proxy's module graph would break the build. Splitting the config is
 * what keeps the adapter out of it.
 *
 * The GitHub provider reads `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` from the environment on its
 * own — v5 infers `AUTH_<PROVIDER>_ID` / `_SECRET` by convention, so they are not named here.
 */
export default {
    providers: [GitHub],
} satisfies NextAuthConfig;
