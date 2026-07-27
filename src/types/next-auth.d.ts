import type { DefaultSession } from "next-auth";

/**
 * `session.user.id` is not part of the default session shape, but the whole query layer scopes
 * reads by owner — so the id has to be typed, not cast at each call site. The `jwt` / `session`
 * callbacks in `auth.ts` are what actually put it there.
 */
declare module "next-auth" {
    interface Session {
        user: {
            id: string;
        } & DefaultSession["user"];
    }
}

/**
 * Augmented on `@auth/core/jwt`, not `next-auth/jwt` — the latter is a bare re-export, so declaring
 * against it does not reach the interface. `JWT extends Record<string, unknown>`, so without this
 * every token field reads as `unknown` and silently type-errors on assignment rather than on access.
 */
declare module "@auth/core/jwt" {
    interface JWT {
        id?: string;
    }
}
