import NextAuth from "next-auth";
import { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";

import { EMAIL_UNVERIFIED_CODE, RATE_LIMITED_CODE } from "@/lib/auth-errors";
import { signInSchema } from "@/lib/auth-schemas";
import { prisma } from "@/server/infra/prisma";
import { checkRateLimit, clientIp } from "@/server/infra/rate-limit";
import { ABSENT_USER_HASH } from "@/server/passwords";
import authConfig from "./auth.config";

/**
 * The Node-runtime authentication setup: the complete NextAuth instance the application signs in
 * with.
 *
 * The other half of the split `auth.config.ts` describes. This file adds what cannot run on the edge
 * — the Prisma adapter, the real credentials `authorize`, and the callbacks that carry the user id
 * into the token — and exports the four bindings the rest of the application uses: `auth()` (read by
 * `getCurrentUserId` on every authenticated request), `handlers` (the `api/auth/[...nextauth]`
 * route), and `signIn` / `signOut` (the actions in `actions/auth.ts` and `actions/account.ts`). The
 * proxy must not import from here.
 *
 * @remarks
 * This module is where account enumeration is defended against: {@link credentials} makes a wrong
 * password, an unknown address and an OAuth-only account indistinguishable in both their answer and
 * their timing, and it is where the sign-in rate limit is spent.
 */

/**
 * Thrown when the password was right but the address was never confirmed.
 *
 * @remarks
 * A `CredentialsSignin` subclass rather than a bare `null`, so the sign-in form can tell this apart
 * from a bad password and offer to resend the link — a generic "invalid email or password" would
 * strand someone whose credentials are correct. `code` is the only field Auth.js carries through to
 * the caller; everything else about the error is flattened.
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
 * @remarks
 * Every failure returns `null` and none of them say why — not in the response and not in how long it
 * takes to arrive. A wrong password, an unknown email and an OAuth-only account are one outcome from
 * the outside, so the form cannot be used to enumerate accounts.
 *
 * The rate limit lives here rather than in the sign-in Server Action because this is the only place
 * every sign-in passes through. The action guards the form;
 * `POST /api/auth/callback/credentials` is a public endpoint a script can drive without ever loading
 * the form, and that script is the threat.
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
        // guesses per quarter hour makes an online password attack pointless, and it is also ~2.5s
        // of CPU an unauthenticated caller can no longer spend at will.
        //
        // Keyed by address *and* address block. Per-IP alone would lock every user behind one office
        // NAT out because of one of them; per-email alone would let anyone lock an account they know
        // the address of out of their own account. Together, each pair gets its own budget.
        //
        // A success costs a token too: the budget is per person per account, so it bounds a
        // legitimate user at five sign-ins a quarter hour, while a scheme that refunded correct
        // guesses would reveal by its timing which guesses were correct.
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

        // A null hash means an OAuth-only account — one that only ever signed in with GitHub must
        // not be reachable by password. Both that case and a missing row fall through to the decoy
        // hash rather than returning early, so all three failures take the same time.
        const hash = user?.password ?? ABSENT_USER_HASH;
        const passwordMatches = await bcrypt.compare(parsed.data.password, hash);

        if (!passwordMatches || !user?.password) return null;

        // *After* the compare, which is what makes naming this state safe: by this line the caller
        // has proven they know the password, so the account's existence is not disclosed by the
        // answer. Above the compare it would leak which addresses are registered and reopen the
        // timing gap the decoy hash closes.
        if (!user.emailVerified) throw new EmailUnverifiedError();

        return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
});

/**
 * The application's NextAuth instance.
 *
 * @remarks
 * `strategy: "jwt"` is required rather than preferred. The adapter's default `"database"` strategy
 * reads the session table on every request, which the edge proxy cannot do; the JWT carries the
 * identity instead, so the proxy authorizes without touching Postgres.
 */
export const { auth, handlers, signIn, signOut } = NextAuth({
    ...authConfig,
    // Substitution, not concatenation: appending would leave the placeholder ahead of this one in
    // the array and every sign-in would hit it first. Mapping over the edge config also keeps
    // `auth.config.ts` the single list of providers — GitHub passes through untouched.
    providers: authConfig.providers.map((provider) =>
        "id" in provider && provider.id === "credentials" ? credentials : provider,
    ),
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: "jwt",
        /**
         * Seven days, against Auth.js's default of thirty.
         *
         * @remarks
         * This bounds exposure; it does not revoke. Nothing can invalidate a JWT that has already
         * been issued — the token carries no version claim — so changing a password from `/settings`
         * or a reset link leaves every other device signed in. The fix is a `sessionVersion` (or
         * `passwordChangedAt`) on `User`, compared on each request, which is a database read per
         * request and therefore reopens the session-strategy decision above rather than patching it.
         *
         * Auth.js re-issues the token on activity (`updateAge`, 24h by default), so this is the
         * **idle** window: it closes the abandoned-browser and stolen-laptop cases, and does not
         * bound a session someone is actively using.
         */
        maxAge: 7 * 24 * 60 * 60,
    },
    events: {
        /**
         * Marks a GitHub sign-up verified.
         *
         * @remarks
         * The provider's profile mapping does not populate `emailVerified`, so every OAuth account
         * would otherwise land with `null` — making the column mean "verified, or signed up with
         * GitHub", which is useless as the safety condition for account linking. Asserting it is
         * sound because GitHub only exposes addresses it has itself verified.
         *
         * `linkAccount` fires exactly once, when the `Account` row is created, so this does not
         * re-run on every subsequent sign-in. `sweepUnverifiedAccounts` in `server/unverified.ts`
         * depends on that: it excludes any user with a linked account, so a failure of this write
         * cannot get a real GitHub account swept.
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
