# Auth Security Review

**Last audited:** 2026-09-01
**Scope:** NextAuth v5 config, credentials, email verification, password reset, profile account
actions, and — new since the 2026-08-03 audit — account mutations' billing interaction, Stripe
billing/webhook, the auth-adjacent rate limiter, session recovery, and per-request authorization of
user-owned objects (upload / file serving).
**Files reviewed:** 40+ (full list in-line below by section)

## Summary

This is a re-audit, not a first pass: every finding in the 2026-08-03 report was re-verified against
the current code, and every file that has landed since then was read line by line for the first time
— `src/actions/account.ts`, `src/actions/billing.ts`, `src/server/billing.ts`,
`src/app/api/webhook/stripe/route.ts`, `src/lib/rate-limit.ts`, `src/app/api/auth/stale-session/route.ts`,
`src/app/api/upload/route.ts`, and `src/app/api/files/[id]/route.ts`. The headline change is that the
single highest-priority item from the last report — **no rate limiting** — is now built:
`feature/rate-limiting-auth` (`src/lib/rate-limit.ts`) puts Upstash Redis sliding windows on all five
auth entry points plus upload, checkout, and every AI endpoint, fails open on a limiter outage with a
bounded 1-second timeout rather than hanging, and is keyed to close the enumeration and denial-of-service
angles specific to each route (IP+email vs. IP alone vs. user id). That known gap is resolved.

The new billing surface (Stripe checkout, portal, webhook, and the account-deletion billing gate) holds
to the same standard as the rest of this codebase: the webhook is signature-verified and idempotent by
re-reading truth from the Stripe API rather than trusting the event payload, the deletion gate asks
Stripe rather than the possibly-stale local `isPro` flag, and every user-initiated billing action
resolves its account from the session. The two new object-serving routes (`POST /api/upload`,
`GET /api/files/[id]`) authorize per request against the owning item/user rather than a path the caller
supplies, and `isOwnedKey`'s key-shape check closes the same class of defeat a `..`-segment path
traversal would otherwise open. `GET /api/auth/stale-session` re-confirms the row is actually missing
before touching the cookie, which is what keeps a `GET` endpoint that clears a session safe to expose
(otherwise it would be logout CSRF).

No new Critical, High, or Medium findings survived the verification protocol. Of the previous report's
"Known / Already Tracked" gaps: **rate limiting is now fixed**; session revocation and the mixed-case
GitHub email gap are unchanged and remain open, at their prior severities. Total: **0 Critical, 0 High,
0 Medium, 0 Low new findings.**

## Findings

No findings at any severity survived the verification protocol on this pass either. Every candidate
concern raised while reading the new billing, webhook, upload, and file-serving code resolved to a
guard already in place — the webhook's signature check, `isOwnedKey`'s UUID-shaped suffix requirement,
the deletion gate's live Stripe query, or the rate limiter's account-keyed buckets on the two
session-gated cost-bearing routes (`upload`, `checkout`). See "Needs Confirmation" for one item that
falls short of a finding, and "Known / Already Tracked" for what is deliberately unresolved and why.

## Known / Already Tracked

- **No rate limiting — RESOLVED.** The 2026-08-03 report's top-priority gap. `src/lib/rate-limit.ts`
  (added in `feature/rate-limiting-auth`, landed after that audit) puts Upstash Redis sliding windows on
  sign-in (`src/auth.ts:66`, keyed IP+email, 5/15m), register (`route.ts:27`, IP, 3/h), forgot-password
  (`route.ts:45`, IP, 3/h), reset-password (`route.ts:29`, IP, 5/15m), and resend-verification
  (`route.ts:91`, IP+email, 3/15m) — closing exactly the amplification vectors the prior report flagged
  (bcrypt-12 CPU and Resend sends). It also covers the two new cost-bearing session-gated routes,
  `upload` (30/10m, keyed on user id) and `checkout` (10/10m, keyed on user id). Fails open on a limiter
  outage (`allowed()`, `rate-limit.ts:121`), bounded by a 1-second timeout (`withTimeout`,
  `rate-limit.ts:229`) so a hung Redis cannot hang sign-in — verified this is a deliberate, documented
  trade-off (an availability outage of the rate limiter must not become an availability outage of the
  product) rather than an oversight. No longer tracked as open.
- **No session revocation** — `src/auth.ts:141-146` (`jwt` callback) still carries only `token.id`, no
  version/`passwordChangedAt` claim. `src/actions/account.ts:74-77` documents that a password change
  does not evict sessions held elsewhere, and this audit confirms the code still matches that comment.
  Account deletion is unaffected — `getCurrentUser` (`src/server/current-user.ts:48-50`) redirects to
  `/api/auth/stale-session` for a session whose row is gone (previously it threw; the redirect is a UX
  improvement from `fix/stale-session-user`, not a security change), so every authenticated read still
  fails closed after deletion. Severity **Medium**, unchanged.
- **Mixed-case GitHub email** can still escape the register route's lowercased duplicate check
  (`src/app/api/auth/register/route.ts:56-61` looks up by the lowercased, schema-normalized `email`;
  the GitHub profile's address is not normalized before the adapter writes it, and `prisma/schema.prisma:25`
  still declares `email String @unique` with no `citext`). Confirmed still present. Severity **Low**,
  unchanged.
- **`Tag.name` globally unique rather than per-user** — out of scope for this audit (not an auth file),
  noted only because `context/project-overview.md` §11 groups it with the above. Unchanged.

## Needs Confirmation

- **The pre-hash token check in `reset-password` implicitly depends on the rate limiter's fail-open
  behavior being rare.** `POST /api/auth/reset-password` checks the token *before* hashing specifically
  so a junk token cannot buy ~500ms of bcrypt CPU (`route.ts:56-62`), and the rate limiter is a second,
  independent defense on top of that ordering. Both are sound individually — the check-before-hash
  ordering holds regardless of the limiter's state, so this is not a defect — but the ordering is what
  actually carries the weight during a Redis outage (when `checkRateLimit` fails open per
  `rate-limit.ts:121`), and that dependency is implicit rather than commented at the call site. Worth a
  one-line cross-reference comment; not worth a severity rating.

## Passed Checks

**Credentials**
- Every write path still hashes at the single pinned cost factor: `PASSWORD_HASH_ROUNDS = 12`
  (`src/server/passwords.ts:17`), used by registration (`register/route.ts:83`), reset
  (`reset-password/route.ts:68`), and profile change (`src/actions/account.ts:71`) — one `hashPassword()`
  call site apiece.
- Every comparison is `bcrypt.compare`, never `===`: sign-in (`src/auth.ts:87`) and profile password
  change (`src/actions/account.ts:62`).
- `ABSENT_USER_HASH` (`src/server/passwords.ts:27`) is compared against on every sign-in miss, closing
  the account-existence timing oracle exactly as before (`src/auth.ts:86-89`).
- Password schema (`src/lib/auth-schemas.ts:22-27`) still rejects rather than truncates anything over
  72 bytes.
- No password value appears in any log line, error message, view model, or client bundle across the
  full current file set, including the new ones — `endBillingRelationship`, `syncSubscriptionState`, and
  the webhook handler never touch `password` at all, and their `console.error` calls
  (`webhook/stripe/route.ts:72,88,100`) log only the caught error or the event type.

**Tokens**
- Verification and reset tokens are still `randomBytes(32)`, base64url-encoded
  (`src/server/verification.ts:49`), stored as a SHA-256 digest (`verification.ts:61`), TTL-enforced on
  use (`verification.ts:155,235`), single-use via `deleteMany` (`verification.ts:119-123`), and
  purpose-prefixed (`src/server/token-identifiers.ts`) — all unchanged from the prior audit and
  re-verified line by line.
- Reset TTL (1 hour) is still materially shorter than verification's (24 hours)
  (`verification.ts:43-44`).
- Unverified accounts still cannot sign in, checked after the bcrypt compare (`src/auth.ts:95`).

**Enumeration**
- `POST /api/auth/verify-email` (resend) and `POST /api/auth/forgot-password` both still return an
  identical `200 { ok: true }` immediately, deferring every account-dependent read/write/email-send into
  `after()` — re-verified against the current source (`verify-email/route.ts:69-122`,
  `forgot-password/route.ts:40-93`).
- Sign-in's uniform-latency path (see Credentials) closes the same leak for the credentials provider,
  and now also rate-limits *without* reopening it: a 429 depends only on the caller's own request count,
  keyed IP+email, never on whether the address exists (`rate-limit.ts:42`).
- `resolveCallbackUrl` (`src/lib/auth-redirects.ts:64-76`) still accepts only same-origin relative paths.
- New: `GET /api/auth/stale-session` (`route.ts:22-49`) re-checks that the account row is genuinely
  missing before clearing the cookie, which is what makes a `GET` endpoint that ends a session safe to
  expose publicly rather than a logout-CSRF vector — a forged `<img>` request against it is inert for
  any session naming a surviving account.

**Session & Authorization**
- `getCurrentUserId`/`getCurrentUser` (`src/server/current-user.ts`) remain the sole path from a session
  to a user id, fail closed (throw, or redirect to the stale-session handler) on no session or a missing
  row, and are `cache()`-wrapped per request.
- `changePassword` and `deleteAccount` (`src/actions/account.ts`) resolve the acting user from
  `getCurrentUserId`/`getCurrentUser`; new: `startCheckout` and `openBillingPortal`
  (`src/actions/billing.ts:37,92`) do the same — neither payload accepts a `userId` naming the account
  it acts on, and `startCheckout` maps only a `BillingCycle` to a Stripe Price id server-side rather than
  accepting a price id from the client (`billing.ts:52-55`), so a crafted payload cannot check out
  against an arbitrary price.
- `changePassword` still re-verifies `currentPassword` via `bcrypt.compare` despite a valid session
  (`src/actions/account.ts:62`).
- `deleteAccount`'s typed-email confirmation is still re-checked server-side, case-insensitively
  (`account.ts:115-122`), and `signOut` still sits outside the `try` (`account.ts:162`).
- New: `deleteAccount` refuses while `hasBillableSubscription(user.id)` is true (`account.ts:131-135`),
  and that check asks the **Stripe API** rather than the local `isPro` column
  (`src/server/billing.ts:212-227`) — a missed webhook that left the row saying "free" for an account
  Stripe is still billing does not let the deletion through, which is the exact failure mode a
  cache-trusting gate would have.
- New: `POST /api/upload` (`api/upload/route.ts:26-33`) and `GET /api/files/[id]`
  (`api/files/[id]/route.ts:21-24`) both authorize per request. Upload resolves the acting user from
  `getCurrentUser()` and never accepts one from the payload; file serving looks up the *item* scoped to
  `getCurrentUserId()` inside `getItemFile` (`src/server/items.ts:209-222`, `where: { id, userId }`) and
  only then reads the R2 key off the row that comes back — the caller never gets to name an object
  directly, so there is no path string for a `..` segment to defeat.
- New: `isOwnedKey` (`src/lib/r2.ts:97-103`) re-validates a client-round-tripped upload key against both
  the caller's `users/<id>/` prefix *and* a strict UUID-plus-extension shape (`KEY_SUFFIX` regex), which
  is what stops a key that merely starts with the right prefix but contains a traversal segment from
  being accepted by `createItem` — confirmed by reading `src/actions/items.ts:112`, where the check runs
  before the fileKey is trusted, and by the existing `r2.test.ts` cases covering a `..`-segment attempt
  and a non-UUID suffix.
- New: `src/app/api/webhook/stripe/route.ts` verifies the Stripe signature
  (`stripe().webhooks.constructEventAsync`, `route.ts:68`) against `STRIPE_WEBHOOK_SECRET` before
  touching the raw body, refuses to run with that secret unset (`route.ts:44-50`, 500 rather than a
  silent 200 that would drop every subscription event), and derives entitlement by re-reading the
  subscription list from Stripe (`syncSubscriptionState`, `server/billing.ts:70-107`) rather than
  trusting the event payload — which makes replay, duplicate, and out-of-order delivery all converge on
  the same correct state with no processed-event table needed.
- `ProfileViewModel`/`UserViewModel`/`AccountSettingsViewModel`/`BillingViewModel` never carry the
  password hash or another user's data — `getAccountSettings` (`src/server/profile.ts:57-92`) selects
  `password` only to collapse it to `hasPassword`, and `getBillingSummary` (`server/billing.ts:116-137`)
  reads only the signed-in user's own Stripe columns.
- `getItemFile` (`server/items.ts:209-222`), used by `GET /api/files/[id]`, scopes its `findFirst` to
  the session's `user.id` — one of three call sites in this codebase where item ownership sits in the
  Prisma `where` rather than being checked after the fact.

**Validation**
- Every entry point still parses with Zod before touching the database, including the new billing
  action: `startCheckout(cycle: BillingCycle)` (`billing.ts:36`) takes a typed enum argument directly
  rather than parsing a form, which is a stronger guarantee than Zod for a value that never leaves
  TypeScript's type system — a `BillingCycle` that is not `"monthly" | "yearly"` cannot compile, let
  alone be sent.
- `POST /api/upload` (`upload/route.ts:44-50`) validates the uploaded `File` instance and item-type
  string are present and well-formed before any R2 call, and `validateUpload` (referenced at
  `upload/route.ts:64`) is the authority on size/extension/media-type — the client-side check exists
  only to fail fast.
- HTML injection in email markup: unchanged, `name` is still the only user-supplied value reaching
  email HTML and is escaped (`src/lib/email.ts:64-70`).

**Secrets**
- `AUTH_SECRET`, `AUTH_GITHUB_ID/SECRET`, `RESEND_API_KEY`, `DATABASE_URL` are all still read from
  `process.env` with no committed values. New secrets introduced since the last audit —
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `UPSTASH_REDIS_REST_URL`/`_TOKEN`,
  `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` — follow the identical pattern: lazily
  constructed clients (`lib/stripe.ts:37-50`, `lib/rate-limit.ts:144-164`, `lib/r2.ts:31-53`) so a
  missing credential fails at first use rather than breaking `next build`, each module marked
  `import "server-only"` despite living in `lib/` (a client-reachable directory in this project) for the
  explicit reason that a mistaken client import of a Stripe/Redis/R2 credential must be a build error,
  not a runtime leak. No `NEXT_PUBLIC_*` prefix on any of them (checked by grep across `src/`).
  `R2_PUBLIC_URL` is deliberately never read (`lib/r2.ts:18-21`) — the bucket is private and every
  object is served through the authorizing route.

## Priority Actions

1. **Nothing security-critical is outstanding.** The one item from the last audit that carried real
   weight — no rate limiting — is now fixed. What remains open (session revocation, mixed-case GitHub
   email) is unchanged and was already correctly deferred rather than overlooked.
2. If session revocation becomes a priority ahead of the account-linking work it's deferred behind, the
   `passwordChangedAt`/`sessionVersion` claim discussed in `project-overview.md` §11 is the documented
   path — no action needed until that trade-off is revisited.
3. Migrate `User.email` to `citext` (or add a case-insensitive lookup) to close the mixed-case GitHub
   email gap across register, resend, and forgot-password.
4. Low priority, hygiene only: add the one-line comment noted under "Needs Confirmation" cross-referencing
   `reset-password`'s check-before-hash ordering to the rate limiter's fail-open behavior, so a future
   reader does not have to reconstruct why the ordering matters independently of the limiter.
5. No action needed on the new billing/upload/file surface — it was built to the same standard as the
   rest of the auth surface and nothing in it needs follow-up.
