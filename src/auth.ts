import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";

import { signInSchema } from "@/lib/auth-schemas";
import { prisma } from "@/lib/prisma";
import authConfig from "./auth.config";

/**
 * A real bcrypt hash of a random string that nothing knows, compared against when no account
 * matches. Its only job is to burn the same ~500ms the genuine path spends hashing.
 *
 * Returning early on a missing account leaks which emails are registered: the miss answers in
 * ~70ms and the hit in ~550ms, which is a stopwatch away from an account list. Its cost factor
 * must match `PASSWORD_HASH_ROUNDS` in `app/api/auth/register/route.ts` or the gap reopens.
 */
const ABSENT_USER_HASH = "$2b$12$1AOauVh.zv9Unpj6DzfsTumooYhJ3avF0tY1bvv.MnB0TqU9uu4Yq";

/**
 * The real email/password check, replacing the always-null placeholder in `auth.config.ts`.
 *
 * Every failure returns `null` and none of them say why — not in the response and not in how long
 * it takes to arrive. A wrong password, an unknown email, and an OAuth-only account are one
 * outcome from the outside, so the form cannot be used to enumerate accounts.
 */
const credentials = Credentials({
    credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
    },
    authorize: async (raw) => {
        const parsed = signInSchema.safeParse(raw);

        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
            where: { email: parsed.data.email },
            select: { id: true, email: true, name: true, image: true, password: true },
        });

        // A null hash means an OAuth-only account (see `User.password` in the schema) — an account
        // that only ever signed in with GitHub must not be reachable by password. Both that case
        // and a missing row fall through to the decoy hash rather than returning early, so all
        // three failures take the same time.
        const hash = user?.password ?? ABSENT_USER_HASH;
        const passwordMatches = await bcrypt.compare(parsed.data.password, hash);

        if (!passwordMatches || !user?.password) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
});

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
    // Substitution, not concatenation: appending would leave the placeholder in the array ahead of
    // this one and every sign-in would hit it first. Mapping over the edge config also keeps
    // `auth.config.ts` the single list of providers — GitHub passes through untouched.
    providers: authConfig.providers.map((provider) =>
        "id" in provider && provider.id === "credentials" ? credentials : provider,
    ),
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
