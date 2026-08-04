import NextAuth from "next-auth";
import { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";

import { EMAIL_UNVERIFIED_CODE, RATE_LIMITED_CODE } from "@/lib/auth-errors";
import { signInSchema } from "@/lib/auth-schemas";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { ABSENT_USER_HASH } from "@/server/passwords";
import authConfig from "./auth.config";

/**
 * Thrown when the password was right but the address was never confirmed.
 *
 * A `CredentialsSignin` subclass rather than a bare `null` so the sign-in form can tell this apart
 * from a bad password and offer to resend the link — a generic "invalid email or password" would
 * strand someone whose credentials are perfectly correct. `code` is the only field Auth.js carries
 * through to the caller; everything else about the error is flattened.
 */
class EmailUnverifiedError extends CredentialsSignin {
    code = EMAIL_UNVERIFIED_CODE;
}

/** Thrown when this address has spent its guesses from this address block. */
class RateLimitedError extends CredentialsSignin {
    code = RATE_LIMITED_CODE;
}

/**
 * The real email/password check, replacing the always-null placeholder in `auth.config.ts`.
 *
 * Every failure returns `null` and none of them say why — not in the response and not in how long
 * it takes to arrive. A wrong password, an unknown email, and an OAuth-only account are one
 * outcome from the outside, so the form cannot be used to enumerate accounts.
 *
 * The rate limit lives here rather than in the sign-in Server Action because this is the only place
 * every sign-in has to pass through. The action guards the form; `POST /api/auth/callback/credentials`
 * is a public endpoint that a script can drive without ever loading the form, and that script is the
 * threat. Limiting one layer up would have protected the only caller that was never the problem.
 */
const credentials = Credentials({
    credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
    },
    authorize: async (raw) => {
        const parsed = signInSchema.safeParse(raw);

        if (!parsed.success) return null;

        // Ahead of the lookup and the bcrypt compare, which are the costs worth capping: five
        // guesses per quarter hour is what makes an online password attack pointless, and it is also
        // ~2.5s of CPU an unauthenticated caller can no longer spend at will.
        //
        // Keyed by address *and* address block. Per-IP alone would lock every user behind one office
        // NAT out because of one of them; per-email alone would let anyone lock an account they know
        // the address of out of their own account, which is a denial of service handed to the
        // attacker. Together, each pair gets its own budget.
        //
        // Costs a token on success too. That is deliberate and cheap: the budget is per person per
        // account, so it bounds a legitimate user at five sign-ins a quarter hour — far more than
        // anyone does — while a scheme that refunded correct guesses would have to reveal, by its
        // timing, which guesses were correct.
        const limit = await checkRateLimit("signIn", await clientIp(), parsed.data.email);

        if (!limit.success) throw new RateLimitedError();

        const user = await prisma.user.findUnique({
            where: { email: parsed.data.email },
            select: {
                id: true,
                email: true,
                name: true,
                image: true,
                password: true,
                emailVerified: true,
            },
        });

        // A null hash means an OAuth-only account (see `User.password` in the schema) — an account
        // that only ever signed in with GitHub must not be reachable by password. Both that case
        // and a missing row fall through to the decoy hash rather than returning early, so all
        // three failures take the same time.
        const hash = user?.password ?? ABSENT_USER_HASH;
        const passwordMatches = await bcrypt.compare(parsed.data.password, hash);

        if (!passwordMatches || !user?.password) return null;

        // Deliberately *after* the compare, and this ordering is the whole reason the check is
        // safe. By this line the caller has proven they know the password, so naming the account's
        // state discloses nothing they had not already established. Moving it above the compare
        // would leak which emails are registered and reopen the timing gap the decoy hash closes.
        if (!user.emailVerified) throw new EmailUnverifiedError();

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
    events: {
        /**
         * Marks a GitHub sign-up verified.
         *
         * The provider's profile mapping does not populate `emailVerified`, so every OAuth account
         * would otherwise land with `null` — making the column mean "verified, or signed up with
         * GitHub, we cannot tell". That ambiguity would make the column useless as the safety
         * condition for the account-linking work this feature exists to enable.
         *
         * Asserting it is sound because GitHub only ever exposes addresses it has itself verified.
         * `linkAccount` is the right hook: it fires exactly once, when the `Account` row is created,
         * so this does not re-run on every subsequent sign-in.
         */
        async linkAccount({ user }) {
            await prisma.user.update({
                where: { id: user.id },
                data: { emailVerified: new Date() },
            });
        },
    },
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
