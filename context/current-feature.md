# Current Feature: Email Verification

## Feature

**Email verification on registration (Resend)** — a new credentials account is created unverified
and cannot sign in until the user clicks a single-use link emailed to the address. Establishes
`User.emailVerified` as a trustworthy signal, which the account-linking work that follows depends on.

## Status

In Progress

## Goals

- Install `resend`; add a server-only `src/lib/email.ts` holding the client and a
  `sendVerificationEmail` helper.
- On successful registration: create a `VerificationToken`, email an absolute link, and return
  "check your inbox" — no longer sign the new account straight in.
- `GET /verify-email?token=…` consumes the token: reject unknown/expired, set `User.emailVerified`,
  delete the row (single use), redirect to `/sign-in?verified=1`.
- Block credentials sign-in while `emailVerified` is null, without weakening the uniform-failure
  discipline in `authorize()` (see Notes — the unverified branch goes *after* the bcrypt compare).
- Add a resend-verification path so a lost or expired email is not a locked-out account.
- Set `emailVerified` for GitHub sign-ups too (see Notes — the provider does not do it).
- Add `/verify-email` to `PUBLIC_ROUTES` in `src/proxy.ts`.
- Document `RESEND_API_KEY`, `EMAIL_FROM`, and `AUTH_URL` in `.env.example`.
- Report every outcome in the UI: inbox prompt after registering, invalid/expired/used token,
  and an unverified sign-in attempt with a resend link.
- Remove the now-dead `welcome=new` path once registration stops signing accounts in.

Added during implementation, not in the original spec — both are developer tooling in `scripts/`,
kept out of the application on purpose (see Notes, "Why the workarounds live in `scripts/`"):

- `npm run email:test -- addr@example.com` (`scripts/test-email.ts`) — sends one email and polls
  `GET /emails/:id` until `last_event` settles, so the asynchronous failure becomes a synchronous
  verdict. The tool that says whether the transport works, before or after any domain change.
- `npm run user:verify -- addr@example.com` (`scripts/verify-user.ts`) — marks an account verified
  by hand, the stand-in for clicking the link while no email can arrive. Refuses to run when
  `NODE_ENV=production`, before it reads argv or opens a connection.

## Notes

### No migration needed

`User.emailVerified` and the `VerificationToken` model already exist from the NextAuth scaffold
(`prisma/schema.prisma`). This feature is application code only.

### Telling an unverified user why, without an enumeration leak

`authorize()` deliberately makes a wrong password, an unknown email, and an OAuth-only account
indistinguishable. "Unverified" must not become the exception that breaks it — but it does not have
to. Check verification only **after** `bcrypt.compare` succeeds: at that point the caller has proven
they know the password, so telling *them* the account is unverified discloses nothing they did not
already establish. Returning it before the compare would both leak existence and reopen the timing
gap the decoy hash closes.

Carry it as a `CredentialsSignin` subclass with a distinct `code`, so the sign-in form can render a
resend link rather than the generic "Invalid email or password."

### GitHub accounts are created unverified

The GitHub provider's profile mapping does not populate `emailVerified`, so every OAuth sign-up
lands with `null`. Left alone, `emailVerified` would mean "verified, or signed up with GitHub, we
can't tell" — and the Case A linking rule that this whole feature exists to enable could never trust
it. Set it explicitly for GitHub sign-ups, which is sound because GitHub only exposes verified
addresses.

### Token handling

Store a SHA-256 hash of the token and put the raw value in the link, so a database read does not
yield working verification links. Random 32 bytes, 24-hour expiry, deleted on use.

### Knock-on changes to existing code

`RegisterForm` currently signs the new account in immediately after a 201 and redirects to
`/?welcome=new`. That block goes away. Check whether `welcome=new` in `actions/auth.ts` /
`WelcomeToast` still has a caller afterwards, and remove it if not.

### Delivery is blocked at Resend, and it is their defect — ticket open

**The application code is complete and does not need changing.** Every email this Resend account has
ever sent has failed, from its first onward. The dashboard reason is always:

> **Domain is not verified:** The domain used to send this email needs to be verified.

That message is misleading. It appears for sends from `onboarding@resend.dev`, which is *Resend's*
domain and cannot be verified by us. `GET /domains` returns an empty list, so there is no
half-finished verification to resume either.

Every precondition for Resend's documented no-domain testing path is satisfied, and it still fails:

| Requirement | Status |
|---|---|
| Recipient is the account owner's own address | ✅ `tomliron88@gmail.com` |
| Sender is `onboarding@resend.dev` | ✅ |
| API key is full access, not `sending_access` scoped to a `domain_id` | ✅ proven — the key serves `GET /domains` and `GET /api-keys`, which a sending-only key cannot |
| An unauthorized recipient would return a synchronous **403** | ✅ we get `200`, so that rule is not what fires |
| `onboarding@resend.dev` → `delivered@resend.dev` (Resend's own simulator) | ❌ fails too — no recipient rule can explain this |

A support ticket is open. Until it is answered, treat delivery as unavailable and everything behind
the link as verified by other means (see below).

Do not conclude from this that a verified domain is merely optional — production needs one
regardless, and verifying one is also the fastest way to route around the defect if the ticket
stalls. `EMAIL_FROM` currently defaults to `onboarding@resend.dev` so the app runs; pointing it at a
verified domain is the entire fix, with no code change beside it.

What makes this class of failure expensive: nothing synchronous reports it. `POST /emails` returns
`200` with an id, the SDK's `error` is `null`, and the API-log page shows a green `200`. The failure
is asynchronous and surfaces only in `last_event`. `npm run email:test` exists to collapse that gap.

`RESEND_API_KEY` and `EMAIL_FROM` also have to be set in the Vercel project environment — a
committed `.env.production` is not read by Vercel.

### Why the workarounds live in `scripts/`, not in the app

The first attempt printed the verification link to the server console from inside
`sendVerificationEmail` whenever `NODE_ENV !== "production"`. That is the mistake to avoid repeating.
It made the *application* dishonest: the feature reported success while the transport was broken, so
it reached "done" without ever delivering an email, and the real fault stayed hidden behind a
workaround that felt like progress.

`scripts/test-email.ts` and `scripts/verify-user.ts` do the same jobs without that cost. A developer
running a script against a dev database cannot make the product lie — no code path in the app
changes, a failed send still reports itself in the UI, and the scripts are visibly separate from the
feature rather than woven into it.

### Verified without a working inbox

The token lifecycle was exercised against the dev database with a throwaway harness — 12 cases, all
passing: the raw token is never stored (only its SHA-256), a valid token verifies, a reused one is
rejected, an already-verified account is distinguished from an invalid link, a resend supersedes the
previous token, an expired token reports `expired` *and* is still consumed, and unknown/empty tokens
are invalid. Plus `auth-errors` unit tests for the two verification error codes.

What remains unproven is exactly one hop: whether Resend hands the message to a mailbox.

### Prior attempt

`wip/email-verification-attempt-1` (`df0a40a`) holds the discarded first implementation, reset
because the fault was never in it. Kept only as history — the current implementation supersedes it,
minus the console-link fallback and plus the two scripts. Safe to delete once this merges.

### Still unrated: rate limiting

Neither `/api/auth/register` nor the resend path is throttled, and resend-verification is an email
bomb aimed at any address. Throttle per address at minimum. Pre-existing gap, now with more surface.

### Relationship to the A/B/C collision cases

This does **not** by itself fix any of them — it is the prerequisite that makes fixing A safe:

- **Case A** (password account → GitHub) stays blocked until a `signIn` callback links the account,
  and that callback is only safe when it requires the existing user's `emailVerified` to be non-null.
  Without that condition: register `victim@x.com` with a known password, never verify, wait for the
  victim to sign in with GitHub, and auto-linking hands over their account.
- **Case B** (GitHub-only → register) needs a separate set-a-password-by-email flow. Registration
  still 409s until then; the message shipped in `b0e5d2e` remains the correct answer.
- **Case C** (GitHub-only → credentials sign-in) resolves once B exists, via a "forgot password"
  link that leaks nothing because it emails either way.

Sequence: verification (this) → linking (A) → set password (B, which settles C).

## History

> One line per feature, newest last. Durable rules belong in `context/project-overview.md`, not here.

1. **Project foundation** (`6a86eb6`) — Stripped the create-next-app boilerplate, added `CLAUDE.md`, set up the `context/` docs folder.
2. **Dashboard UI Phase 1** (`feature/dashboard-phase-1`) — shadcn/ui init, dark mode by default, and the `(dashboard)` route group shell: sidebar, top bar, placeholder main area.
3. **Dashboard UI Phase 2** (`feature/dashboard-phase-2`) — Functional collapsible sidebar (item types with counts, favorite + recent collections, user area). Moved the brand into a full-width top bar so it survives collapse.
4. **Dashboard UI Phase 3** (`feature/dashboard-phase-3`) — Main content area: four stat cards, recent collections row, pinned items, recent items grid. Added `CollectionCard`, `ItemCard`, `StatCard`.
5. **Professional architecture refactor** — Server-only mock queries and explicit view models, read-only item/collection routes, fully derived collection metadata, accessible Radix mobile dialog.
6. **Source structure cleanup** — Separated type contracts from view models and runtime config; standardized module names.
7. **Post-refactor polish** — `[type]` → `[slug]`, shared `EmptyState`, narrowed `SidebarItemTypeViewModel`, dropped dead fallbacks in favor of failing fast on unknown item types.
8. **Prisma readiness cleanup** — Split item list summaries from full content records, made server-only boundaries explicit, added Pro-access scaffolding.
9. **Item-type identity alignment** (`feature/item-type-identity-alignment`) — Split item-type identity (database) from presentation (config), keyed by natural name. Renamed `ContentKind` → `ContentType` and split the overloaded `content` field into real `content` / `url` / `fileUrl` / `fileName` / `fileSize` columns.
10. **Prisma + Neon foundation** (`feature/prisma-neon-foundation`) — Roadmap Phase 0: Prisma 7.8 on Neon with schema, `init` migration, system-type seed, client singleton, and the `npm run db:test` smoke test. Closed the system-type uniqueness hole with a partial index (details in `project-overview.md` §5).
11. **Development seed data** (`feature/seed-data`) — Seeded a demo user, five collections, and eighteen items, made idempotent by delete-then-recreate scoped to the demo user. `Item.contentType` is derived from the item type so a mismatch is unrepresentable.
12. **Dashboard collections from the database** (`feature/dashboard-collections-db`) — Swapped the whole collection read path from mock to Prisma via `src/server/collections.ts` (dashboard, `/collections`, `/collections/[id]`, sidebar). Moved as a unit to avoid emitting real cuids into mock-resolved links, and added `force-dynamic` so rows aren't baked in at build time.
13. **Dashboard items from the database** (`feature/dashboard-items-db`) — Swapped the dashboard's pinned/recent lists and item stat cards to Prisma via `src/server/items.ts`, using counts + scoped queries like the collections module. Fixes the Items stat (16 → 18); sidebar nav and `/items/[slug]` stay mock.
14. **Sidebar item types & collection indicators from the database** (`feature/sidebar-stats-db`) — Moved the sidebar's item-type list (with live per-type counts) and the signed-in user off the mock `getSidebarNav` onto Prisma. Added a "View all collections" link and colored dominant-type dots for recent collections; favorites now lead with the star. Only `/items/[slug]` remains mock-backed.
15. **Retire the mock query layer** (`feature/items-slug-db`) — Moved the last mock-backed route, `/items/[slug]`, onto Prisma via `getItemTypePageData` in `src/server/items.ts`, then deleted `src/server/mock-data/` entirely. Reworked `view-models.test.ts` onto self-contained fixtures and dropped the mock-records tests. All reads are now Prisma end to end.
16. **Project skills** (`acd6889`) — Added `.claude/skills/` with three checked-in project skills: `cleanup` (housekeeping checks), `feature` (feature-workflow management), and `list-components`.
17. **Scan follow-ups** (`fix/scan-perf-and-comments`) — Acted on a codebase-scanner audit: memoized the request-scoped reads (`getCurrentUserId`, `getCurrentUser`, `getItemTypesById`) with React `cache()` to drop duplicate per-render queries, added a defensive `take` bound to the item-type page read, and refreshed two doc comments that still described the retired mock layer.
18. **Codebase-scanner agent** (`feature/codebase-scanner-agent`) — Checked in `.claude/agents/codebase-scanner.md`, a read-only Opus subagent that audits the codebase for security, performance, quality, and refactor findings, scoped to implemented code only (never flags planned/roadmap gaps) and briefed on the project's deliberate architectural divergences.
19. **Types-only seed** (`feature/seed-types-only`) — Added a `--types-only` flag to the seed (`npm run db:seed:types`) that writes the seven system item types and skips the demo user, collections, and items, then ran it against the Neon production branch, which had the `init` migration applied but no rows at all. Item types are reference data every `Item` FKs into, whereas the demo account's password lives in a committed file and must never reach a public deployment. The deployed site still throws until Phase 1 auth replaces the demo-user lookup in `getCurrentUserId()`.
20. **Auth setup — NextAuth + GitHub** (`feature/auth-setup`) — Roadmap Phase 1: NextAuth v5 with the Prisma adapter and GitHub OAuth, on the split config pattern so the edge proxy never pulls in the adapter. Route protection denies by default rather than matching the spec's `/dashboard/*`, which is a route group and therefore not a URL here. `current-user.ts` now resolves the session with no demo-user fallback, since a default owner would hand signed-out requests shared data. The JWT type augmentation has to target `@auth/core/jwt` — `next-auth/jwt` is a bare re-export that declarations cannot reach.
21. **Auth credentials — email/password** (`feature/auth-credentials`) — Roadmap Phase 1, part 2: a Credentials provider beside GitHub and a `POST /api/auth/register` route handler, chosen over a Server Action so the client can tell 400 from 409. `auth.config.ts` holds a placeholder that always returns null and `auth.ts` substitutes the working provider *by id* — appending would leave the placeholder earlier in the array where every sign-in hits it first. All three failure modes (wrong password, unknown email, OAuth-only account) return null and pay the same bcrypt cost via a precomputed decoy hash; without it the miss answered in ~70ms against ~550ms for a hit. Zod validates both entry points from one schema, with email normalization piped *ahead* of validation, since chaining `.trim()` after `z.email()` transforms output that the anchored pattern has already rejected. Added `zod`, which the coding standards require but nothing had needed yet. Known gaps: a mixed-case GitHub email escapes the register route's lowercased duplicate check (needs citext), and neither endpoint is rate limited.
22. **Auth UI — sign in, register & account menu** (`feature/auth-ui`) — Auth Phase 3: an `(auth)` route group serving `/sign-in` and `/register`, plus a sidebar account menu with sign out and a `/profile` stub. The two routes are handled inside the proxy callback rather than excluded from its matcher, since an excluded path never runs the callback and a signed-in user could not then be redirected away from the sign-in form. Success toasts ride the redirect URL (`/?welcome=back|new`) because sign-in redirects from the server and the form is unmounted before it could raise one; `getFirstName` keeps the greeting from addressing people by the email fallback in `UserViewModel.name`. Errors all report inline, toasts are for successful auth only. Three things the spec did not anticipate: `noValidate` is required on the sign-in form or the browser rejects a malformed address silently and no message appears at all, lucide-react v1 dropped its brand icons so the GitHub mark is inlined, and sonner's shipped wiring to `next-themes` would have rendered light toasts over the dark app.
23. **Same-email collision feedback** (`fix/oauth-sign-in-error-feedback`, `b0e5d2e`) — Reported both directions of an email that already belongs to an account created the other way. A password account blocking GitHub sign-in was silent: Auth.js already redirects to `/sign-in?error=OAuthAccountNotLinked` (because `SignInError.kind` is `"signIn"`, so `@auth/core` resolves the target from `pages.signIn`), but the page typed `searchParams` as `{ registered?: string }` and dropped it, leaving the cause visible only in the Vercel logs. A GitHub-only account blocking registration was worse than silent — "an account already exists" implies signing in with a password, which can never succeed against a null hash, with no reset to fall back on. New `lib/auth-errors.ts` maps the client-safe codes with a generic fallback so a raw code is never rendered, and the register route's duplicate check now selects `password` to name GitHub when the hash is null. That widens the 409's disclosure from "this email exists" to "exists via GitHub"; the leak-free alternative needs transactional email. Credentials sign-in stays deliberately vague — it is anonymous, with no proof of address ownership.
