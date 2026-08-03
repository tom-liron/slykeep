# Auth Security Review

**Last audited:** 2026-08-03
**Scope:** NextAuth v5 config, credentials, email verification, password reset, profile account actions
**Files reviewed:** 44

## Summary

This audit re-read every file on the auth surface line by line — config, credential handling, both
token flows end to end, the profile mutations, all auth UI, the dev scripts, and the relevant schema
models. No new Critical, High, or Medium findings survived verification. This is a mature, carefully
built auth stack: bcrypt at a uniform cost of 12 everywhere a password is hashed or compared, a decoy
hash that closes the sign-in timing oracle, `after()`-deferred enumeration parity on both
`forgot-password` and `verify-email` (confirmed against current Next.js `after()` semantics — it runs
non-blocking, after the response is flushed), purpose-prefixed single-use tokens with a documented
concurrent-consumption race that resolves correctly, and profile mutations that re-verify identity
(current-password check) and re-check destructive confirmation server-side. One pre-existing
observation is downgraded from prior review context because the code demonstrably handles it (see
Passed Checks — email-scanner prefetch). The two previously known architectural gaps (no rate
limiting, no session revocation) remain present exactly as documented, plus the mixed-case GitHub
email gap. Total: **0 Critical, 0 High, 0 Medium, 0 Low** new findings.

## Findings

No findings at any severity survived the verification protocol. Every candidate concern raised during
this pass either resolved to a guard already in place one function away, was already on the
deliberate-decisions or known-gaps lists, or could not be turned into a concrete exploit. See
"Needs Confirmation" for the one item that falls short of a finding but is worth a second look, and
"Known / Already Tracked" for the accepted gaps.

## Known / Already Tracked

- **No rate limiting** on `POST /api/auth/register`, `POST /api/auth/verify-email` (resend),
  `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, or credentials sign-in.
  Still matches the codebase: none of these routes have a throttle. Severity **High** in aggregate
  (each is individually a CPU/email-bomb amplifier at bcrypt cost 12 / a Resend send), unchanged from
  prior tracking.
- **No session revocation** — `src/auth.ts:113-118` (`jwt` callback) carries only `token.id`, no
  version/`passwordChangedAt` claim. `src/actions/account.ts:82-85` documents that a password change
  does not evict sessions held elsewhere. Confirmed still true. Account deletion is unaffected —
  `getCurrentUser` (`src/server/current-user.ts:42-44`) throws for a session whose row is gone, so
  every authenticated read fails closed after deletion. Severity **Medium**, unchanged.
- **Mixed-case GitHub email** can escape the register route's lowercased duplicate check
  (`src/app/api/auth/register/route.ts:47-51` looks up by the lowercased, schema-normalized `email`,
  but a GitHub profile's address is not normalized before `linkAccount`/adapter writes). Confirmed
  still present; no `citext` migration yet. The same case-sensitivity also means a mixed-case GitHub
  account cannot be found by the lowercased lookups in resend-verification and forgot-password — a
  minor extension of the same root cause, not a separate bug. Severity **Low**, unchanged.
- **`Tag.name` globally unique rather than per-user** — out of scope for this audit (not an auth
  file), noted only because `context/project-overview.md` §11 groups it with the above. Unchanged.

## Needs Confirmation

- **Email-security-gateway prefetch of the verification link.** Corporate mail scanners (Safe Links,
  similar) sometimes GET-fetch links in an email before the recipient clicks. `GET
  /api/auth/verify-email` (`src/app/api/auth/verify-email/route.ts`) is a side-effecting GET: a
  scanner visit would consume the token and set `emailVerified`. I verified this does **not** lock the
  real user out — `verifyEmailToken` (`src/server/verification.ts:147-171`) falls back to
  `describeAccount`, which reports `already-verified` (not `invalid`) once the account row shows a
  verified timestamp, and the sign-in page renders that as a success message pointing at sign-in. So
  the observed behavior is benign by inspection of the code paths, but it has not been exercised
  against an actual scanning gateway. Open question: does any corporate mail gateway product follow
  redirects or evaluate query strings in a way that could hit `GET` with a *stale* cached copy of the
  link (e.g., re-fetching hours later, past the 24h TTL, producing a confusing "expired" message for a
  user who never got the chance to click it themselves)? If this matters for target users, worth a
  manual test with an actual corporate email gateway rather than further static review.

## Passed Checks

**Credentials**
- Every write path hashes at the single pinned cost factor: `PASSWORD_HASH_ROUNDS = 12`
  (`src/server/passwords.ts:17`), used by registration (`src/app/api/auth/register/route.ts:74`),
  reset (`src/app/api/auth/reset-password/route.ts:59`), and profile change
  (`src/actions/account.ts:79`) — all three call the same `hashPassword()`, so there is exactly one
  place the factor could drift, and it hasn't.
- Every comparison is `bcrypt.compare`, never `===`: sign-in (`src/auth.ts:59`) and profile password
  change (`src/actions/account.ts:70`).
- `ABSENT_USER_HASH` (`src/server/passwords.ts:27`) is compared against on every sign-in miss —
  unknown email, OAuth-only account, and wrong password all pay the same ~550ms bcrypt cost
  (`src/auth.ts:54-61`), closing the account-existence timing oracle.
- Password schema (`src/lib/auth-schemas.ts:22-27`) rejects (never silently truncates) anything over
  72 bytes, the bcrypt truncation boundary, and normalizes email *before* the `z.email()` check so a
  padded address isn't rejected as malformed (`src/lib/auth-schemas.ts:9-15`).
- No password value appears in any log line, error message, view model, or client bundle — verified
  by reading every `console.error` call on the auth surface (`register/route.ts:96,104`,
  `reset-password/route.ts:100`, `account.ts:88,129`, `verify-email/route.ts:107`,
  `forgot-password/route.ts:79`) and confirming each logs only the caught `error` object, never the
  request body.

**Tokens**
- Verification and reset tokens are `randomBytes(32)`, base64url-encoded
  (`src/server/verification.ts:48-50`) — CSPRNG, far above the 32-byte floor.
- Stored as a SHA-256 digest (`src/server/verification.ts:60-62`), so a database dump yields no
  working links; correctly *not* bcrypt-hashed, since the input is already 256 bits of randomness.
- TTL enforced on use, not just stored: `expires < new Date()` is checked in
  `verifyEmailToken`/`consumePasswordResetToken` (`src/server/verification.ts:155,235`), and an
  expired row is still deleted (single-use survives expiry).
- Reset TTL (1 hour, `src/server/verification.ts:44`) is materially shorter than verification's (24
  hours, `src/server/verification.ts:43`), matching the "reset token is a live credential" rationale.
- Single use via `deleteMany` (`consumeRow`, `src/server/verification.ts:119-123`); the row count is
  used to identify exactly one winner when two requests race for the same token — verified against
  the concurrent double-submit case for password reset: both callers can pass the non-consuming
  `checkPasswordResetToken`, both may hash concurrently, but only one `consumeRow` observes `count >
  0`, and the loser is reported `invalid` rather than being allowed to overwrite the winner's new
  password (`src/app/api/auth/reset-password/route.ts:53-67`).
- Purpose separation is enforced by an explicit `identifier` prefix
  (`src/server/token-identifiers.ts`), checked on every lookup (`findToken`,
  `src/server/verification.ts:97-107) — a verification token cannot be posted to the reset endpoint or
  vice versa.
- Resend invalidates the previous link for the same address and purpose: `issueToken` deletes any
  existing row for that `identifier` before creating the new one, in the same transaction
  (`src/server/verification.ts:76-85`).
- Unverified accounts cannot sign in (`src/auth.ts:67`), and the check sits after the bcrypt compare
  so naming the account's state discloses nothing not already proven by a correct password.

**Enumeration**
- `POST /api/auth/verify-email` (resend) and `POST /api/auth/forgot-password` both return an
  identical `200 { ok: true }` immediately, deferring every account-dependent read/write/email-send
  into `after()` (`src/app/api/auth/verify-email/route.ts:68-112`,
  `src/app/api/auth/forgot-password/route.ts:37-84`) — confirmed against Next.js's documented `after()`
  behavior (runs after the response is sent, non-blocking), so no observable latency difference
  remains between a registered and unregistered address.
- Sign-in's uniform ~550ms path (see Credentials) closes the same leak for the credentials provider.
- `resolveCallbackUrl` (`src/lib/auth-redirects.ts:60-72`) accepts only same-origin relative paths,
  rejecting absolute URLs, `//host`, and `/\host` — closing the open-redirect vector on the one page
  where a stolen redirect is worth the most.

**Session & Authorization**
- `getCurrentUserId`/`getCurrentUser` (`src/server/current-user.ts`) are the sole path from a session
  to a user id, throw (fail closed) on no session, and are `cache()`-wrapped per request — every
  server-side auth-scoped read in the profile page goes through them, never through client input.
- `changePassword` and `deleteAccount` (`src/actions/account.ts`) resolve the acting user from
  `getCurrentUserId`/`getCurrentUser`, never from `formData` — no endpoint on this surface accepts a
  `userId` or `email` naming the account it acts on (the reset endpoint is keyed by token, not email,
  by design).
- `changePassword` re-verifies `currentPassword` via `bcrypt.compare` even though the caller holds a
  valid session (`src/actions/account.ts:70-75`).
- `deleteAccount`'s typed-email confirmation is re-checked server-side, case-insensitively
  (`src/actions/account.ts:117-124`), independent of the client's disabled-button gating.
  `signOut` sits outside the `try` (`src/actions/account.ts:136`), so its `NEXT_REDIRECT` throw is not
  caught and reported as a failure for a deletion that already succeeded.
- `ProfileViewModel`/`UserViewModel` (`src/types/view-models.ts:45-51,118-125`) never carry the
  password hash — `getProfile` (`src/server/profile.ts:26,42`) selects `password` only to collapse it
  to a `hasPassword` boolean before it leaves the server boundary.
- `getItemTypeCounts` (`src/server/item-types.ts:45-56`), used by the profile page's usage breakdown,
  scopes both the type lookup and the item `groupBy` to the session's `user.id`.

**Validation**
- Every entry point parses with Zod before touching the database: `authorize`
  (`src/auth.ts:38-40`), `register` (`src/app/api/auth/register/route.ts:30`), `reset-password`
  (`src/app/api/auth/reset-password/route.ts:33`), `forgot-password`
  (`src/app/api/auth/forgot-password/route.ts:48`), and the `verify-email` resend
  (`src/app/api/auth/verify-email/route.ts:79`) — all server-side, independent of the client-side pass
  the forms also run.
- Registration and reset both reject (not truncate) an over-length password and require the schema's
  own confirm-match refinement (`src/lib/auth-schemas.ts:37-48,65-67`).
- HTML injection: `name` is the only user-supplied value reaching email markup, and it is HTML-escaped
  (`src/lib/email.ts:64-70`, applied at `src/lib/email.ts:160,197,237`) before interpolation.

**Secrets**
- `AUTH_SECRET`, `AUTH_GITHUB_ID/SECRET`, `RESEND_API_KEY`, `DATABASE_URL` are all read from
  `process.env` with no committed values (`.env.example` ships placeholders only); no `NEXT_PUBLIC_*`
  prefix appears anywhere under `src/` (checked by grep across the whole tree).
- `scripts/verify-user.ts` — the one tool that can bypass email verification — refuses to run when
  `NODE_ENV=production` or `VERCEL` is set, and additionally requires an interactive host confirmation
  before writing (`scripts/verify-user.ts:35-38,79-90`), so a developer pointed at the wrong
  `DATABASE_URL` gets a second, human-in-the-loop check rather than a silent production write.

## Priority Actions

1. Add a shared rate limiter across `register`, credentials sign-in, `verify-email` (resend), and
   `forgot-password` / `reset-password` — already tracked, still the single highest-value gap on this
   surface given bcrypt-12's ~500ms CPU cost per unauthenticated hash and the open email-bomb vector.
2. If session revocation becomes a priority ahead of the account-linking work it's deferred behind,
   the `passwordChangedAt`/`sessionVersion` claim discussed in `project-overview.md` §11 is the
   documented path — no action needed until that trade-off is revisited.
3. Migrate `User.email` to `citext` (or add a case-insensitive lookup) to close the mixed-case GitHub
   email gap across register, resend, and forgot-password.
4. Low priority: if corporate-gateway link prefetching matters for the target user base, exercise the
   verify-email flow against a real scanning product to close the "Needs Confirmation" item above —
   static reading of `describeAccount`'s fallback suggests it is already handled gracefully.
