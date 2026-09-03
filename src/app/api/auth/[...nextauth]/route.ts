import { handlers } from "@/auth";

/**
 * The NextAuth catch-all: callback, sign-out, session and CSRF endpoints, plus the GitHub OAuth
 * dance.
 *
 * `handlers` is built in `src/auth.ts` from the shared config. The sign-in UI is the custom
 * `/sign-in` page (`auth.config.ts` sets `pages.signIn`), not `/api/auth/signin`. The static
 * `register`, `verify-email`, `forgot-password`, `reset-password` and `stale-session` segments
 * beside this file win over the catch-all and are handled by their own route files.
 */
export const { GET, POST } = handlers;
