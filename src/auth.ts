import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";
import authConfig from "./auth.config";

/**
 * The Node-runtime half of the auth configuration: the edge-safe providers plus the Prisma adapter.
 * Route handlers and server components import from here; the proxy must not (see `auth.config.ts`).
 *
 * `strategy: "jwt"` is required, not preferred. The adapter's default `"database"` strategy reads
 * the session table on every request, which the edge proxy cannot do — the JWT carries the identity
 * instead, so the proxy can authorize without touching Postgres.
 */
export const { auth, handlers, signIn, signOut } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    callbacks: {
        // `user` is only populated on the sign-in pass; afterwards the id is already in the token.
        jwt({ token, user }) {
            if (user?.id) {
                token.id = user.id;
            }
            return token;
        },
        // Surfaces the id as `session.user.id`, which is what the query layer scopes reads by.
        session({ session, token }) {
            if (token.id) {
                session.user.id = token.id;
            }
            return session;
        },
    },
});
