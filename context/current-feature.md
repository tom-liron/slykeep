# Current Feature

## Status

Step 1 of 3 complete. **Step 2 not started** — `fix/verification-link-session`.
Plan and progress: `context/features/verification-hardening-plan.md`.

## Goals

Stop the verification link being swallowed by an existing session. `GET /api/auth/verify-email`
redirects to `/sign-in?verified=1`; the proxy sees a live session, redirects to `/`, and the query
string goes with it — so verifying one account while signed in as another lands silently in the
wrong account with no message.

- Give verification its own result route, in `OPEN_ROUTES`, reachable with or without a session —
  the treatment `/reset-password` already has for the same documented reason.
- When the token's account differs from the session's, say so and offer the choice.

## Notes

`lib/auth-redirects.ts` already carries the reasoning for `/reset-password`; it was never carried
across because verification borrows `/sign-in` rather than owning a page.

## History

Completed features are logged in `context/feature-history.md`.
