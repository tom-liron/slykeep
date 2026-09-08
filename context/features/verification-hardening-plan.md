# Verification hardening — a three-step plan

Written 2026-09-07. Three pieces of work, each on its own branch, in this order. Steps 1 and 2 are
independent bug fixes; step 3 is the feature they clear the way for.

**Complete.** All three steps shipped; the `CLAUDE.md` pointer that referenced this file while the
plan was live has been removed. Kept as the record of what was decided and, for step 3, of two
designs that were built and abandoned before the one that shipped.

## Progress

- [x] **Step 1** — monaco 404s on production (`fix/monaco-production-assets`) — done 2026-09-07
- [x] **Step 2** — the verification link gets swallowed (`fix/verification-link-session`) — done 2026-09-08
- [x] **Step 3** — the soft gate (`feature/soft-verification-gate`) — done 2026-09-08

---

## Step 1 — Monaco 404s on production

`public/monaco` was never deployed. Confirmed by request against the live site: every
`/monaco/vs/*` asset returns 404 while `/favicon.ico` returns 200, so `public/` itself is served and
only this subtree is missing. The editor cannot mount, and read-only code renders as an empty box —
on **every** device, not only on phones, and on every deploy since the first.

The directory is gitignored and built only by `npm run monaco:sync`, wired to npm's `prebuild`
hook. That hook never ran on Vercel. Two candidate causes, and the fix closes both rather than
guessing between them: Vercel invoking `next build` directly and bypassing npm lifecycle scripts, or
`monaco-editor` being absent from the build because it sits in `devDependencies`.

- Move `monaco-editor` to `dependencies` — it is the source of a shipped runtime asset.
- Name the copy in an explicit `buildCommand` in `vercel.json`. A hosted build must not depend on an
  implicit lifecycle hook firing.
- Fall back to plain unhighlighted text when monaco cannot load. Today a missing 24 MB asset and a
  slow network render identically, which is why this survived every deploy unnoticed.

Verify by re-requesting the assets after the deploy lands.

## Step 2 — The verification link gets swallowed

`GET /api/auth/verify-email` consumes the token and redirects to `/sign-in?verified=1`. The proxy
sees a live session, `/sign-in` is a signed-out route, so it redirects to `/` and the query string
goes with it. Verifying account B while signed in as account A lands silently in account A with no
message at all.

`lib/auth-redirects.ts` already documents this exact hazard for `/reset-password` and solves it by
putting that route in `OPEN_ROUTES`. The reasoning transfers word for word; it was never carried
across because verification borrows `/sign-in` rather than owning a page.

- Give verification its own result route, in `OPEN_ROUTES`, reachable with or without a session.
- When the token's account differs from the session's, say so and offer the choice rather than
  guessing which account the person meant.

Correct regardless of which gate model step 3 lands on, which is why it ships separately.

## Step 3 — The soft gate

Registration stops being a wall. `auth.ts` no longer throws `EmailUnverifiedError`, and verification
becomes an entitlement check rather than a door.

### Access states

| State | What works |
|---|---|
| Unverified | **Read-only** — sign in, browse and copy everything, including the starter content. No creating, editing or deleting, and no checkout |
| Verified | Everything |

The restriction applies from the moment the account exists, not after a grace period. That is what
makes it explain itself: the first attempted write is where a person learns the address needs
confirming, rather than a week later when a working app quietly stops working. It follows
[GitHub's model](https://docs.github.com/en/account-and-profile/reference/email-addresses-reference),
which blocks creating repositories, issues, comments, gists, stars and Sponsors for an unverified
address while leaving reading open. The alternative in the field is
[Supabase's default](https://supabase.com/docs/guides/auth/passwords), which refuses sign-in
outright; nothing established uses a silent timer.

Read-only rather than a lockout because every account is seeded with starter content at
registration: an unconfirmed visitor can see what the product is and copy from it, which makes the
seed a demo rather than a wall.

### Account lifecycle

| When | Condition | Action |
|---|---|---|
| Day 7 | still unverified | Deleted |

One rule, and it is the one that already existed. Nothing of the owner's can be lost to it: an
unconfirmed account is read-only from the moment it exists, so it holds exactly the starter content
it was seeded with and nothing else.

### The work

- Remove the login gate in `auth.ts`, and make `api/auth/register` sign the new account in. The
  gate is two halves: the throw that refuses an unconfirmed sign-in, and a registration that ends at
  `/sign-in?registered=sent` rather than in the app.
- A write guard in the mutating actions, following the shape `canUseAi` and the Pro limit checks
  already use. It reads `emailVerified` from the database, never from the session token: the JWT is
  reissued on `updateAge` (24h), so a token-borne flag would leave someone who confirmed on their
  phone read-only on their laptop for a day.
- Gate checkout on the same flag. The AI actions and uploads need no gate of their own — both are
  Pro-only under `ENFORCE_PRO_LIMITS`, and an unconfirmed account cannot reach checkout, so the Pro
  check already refuses them.
- A dismissible banner carrying the resend control, as the standing explanation for why saving is
  refused.
- Leave the nightly sweep as it is, minus the `items`/`collections` guards that seeding invalidated.
- Record the linking rule in `context/decisions.md` (below).

### Why this is safe

Account takeover in this class is a **linking**-layer failure, not a login-layer one.
[CVE-2026-53516](https://github.com/advisories/GHSA-g38m-r43w-p2q7) hit applications whether or not
they gated signup, because the auto-link check read the OAuth provider's verified claim and never
read the local row's `emailVerified`. A hard front door was never what protected against it. There
is no linking here and none is planned, so nothing is exposed today; the rule is recorded so a
future feature cannot reintroduce it.

The rule to record:

> If account linking is ever built, check the **local row's** `emailVerified` when an OAuth sign-in
> matches an existing account by email. Never merge on email match alone, and never accept the
> provider's claim as a substitute.

Spam and abuse are handled by gating billing and AI, and by keeping the seven-day prune for
untouched accounts. [The pre-hijacking study](https://arxiv.org/pdf/2205.10174) names pruning as a
primary mitigation, and a pre-hijacking account is untouched by construction — the attacker
registers the victim's address and then waits — so pruning untouched accounts removes exactly the
risky rows and spares exactly the real ones.

Nobody loses work to an unclicked email: two warnings, ninety days, and the account has been
read-only for eighty-three of them.

### Settled

**2026-09-08.** Verification gates writing and checkout, immediately, with no grace period. The
seven-day soft window this plan originally described was abandoned before it shipped — see
`context/decisions.md`, "How long an unverified account keeps working".
