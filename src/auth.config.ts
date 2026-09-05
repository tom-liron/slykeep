import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";

/**
 * The edge-safe half of the NextAuth configuration: the provider list and the sign-in page, with no
 * database-dependent initialization.
 *
 * The configuration is split in two because `src/proxy.ts` runs on the edge runtime and imports
 * *this* file rather than `auth.ts`. The Prisma client is generated with `runtime = "nodejs"` and
 * `server/infra/prisma.ts` is `server-only`, so pulling the adapter into the proxy's module graph
 * breaks the build; keeping the adapter out is what this file is for. `auth.ts` spreads this configuration and
 * adds the adapter, the JWT callbacks and the real credentials check on top.
 *
 */

/**
 * The providers the application accepts, and the page NextAuth sends people to.
 *
 * @remarks
 * The GitHub provider reads `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` from the environment itself —
 * NextAuth v5 infers `AUTH_<PROVIDER>_ID` / `_SECRET` by convention — so they are not named here.
 *
 * Credentials is a placeholder that always fails. The proxy never uses it: it reads the JWT only,
 * and the sign-in form and callback route are both served by the `auth.ts` instance. The entry
 * exists because `auth.ts` finds it *by id* and substitutes the working provider, which keeps this
 * file the single list of who can sign in — removing it silently removes credentials sign-in. The
 * real check cannot live here: it needs bcrypt and Prisma, neither of which can cross into the edge
 * bundle.
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
