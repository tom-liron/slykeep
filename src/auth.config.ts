import Credentials from "next-auth/providers/credentials";
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
 *
 * Credentials is declared here as a placeholder that always fails. The proxy itself never uses it —
 * it only reads the JWT, and the sign-in form and callback route are both served by the `auth.ts`
 * instance. The entry exists because `auth.ts` finds it *by id* and substitutes the working
 * provider in its place, which keeps this file the single list of who can sign in. Delete it and
 * credentials silently stops being an option; the real check cannot live here because it needs
 * bcrypt and Prisma, neither of which can cross into the edge bundle.
 */
export default {
    // Points NextAuth's own redirects at the custom page instead of its built-in one — the error
    // query param it appends on a failed OAuth callback lands here too.
    pages: { signIn: "/sign-in" },
    providers: [
        GitHub,
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            // Never authorizes. Overridden in `auth.ts`; if this one is ever reached, the override
            // has been lost and denying is the only safe answer.
            authorize: () => null,
        }),
    ],
} satisfies NextAuthConfig;
