import type { DefaultSession } from "next-auth";

/**
 * Module augmentation that carries the application's user id through NextAuth's session and token.
 *
 * Every query in `server/` scopes its reads by owner, so `session.user.id` is read on effectively
 * every authenticated request. NextAuth's default session does not declare it, and its `JWT` extends
 * `Record<string, unknown>`; these two declarations make the id a typed field instead of a cast at
 * each call site. The `jwt` and `session` callbacks in `auth.ts` are what put the value there.
 *
 */

/** Adds `id` to the session's user, which is what every ownership-scoped query reads. */
declare module "next-auth" {
    interface Session {
        user: {
            id: string;
        } & DefaultSession["user"];
    }
}

/**
 * Adds `id` to the token the session is built from.
 *
 * @remarks
 * Targets `@auth/core/jwt` rather than `next-auth/jwt`. The latter is a bare re-export, so declaring
 * against it does not reach the interface — and `JWT extends Record<string, unknown>`, so without
 * this the field reads as `unknown` and errors on assignment rather than on access.
 */
declare module "@auth/core/jwt" {
    interface JWT {
        id?: string;
    }
}
