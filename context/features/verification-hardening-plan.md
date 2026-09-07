# Verification hardening — a three-step plan

Written 2026-09-07. Three pieces of work, each on its own branch, in this order. Steps 1 and 2 are
independent bug fixes; step 3 is the feature they clear the way for.

**This file is the record that survives a cleared session.** `CLAUDE.md` points at it while the plan
is live. Delete the pointer and archive this file when step 3 merges.

## Progress

- [x] **Step 1** — monaco 404s on production (`fix/monaco-production-assets`) — done 2026-09-07
- [ ] **Step 2** — the verification link gets swallowed (`fix/verification-link-session`)
- [ ] **Step 3** — the soft gate (`feature/soft-verification-gate`)

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
| Unverified, days 0–7 | Everything except billing and the AI actions |
| Unverified, day 7+ | **Read-only** — read and copy freely, no creating or editing |
| Verified | Everything |

Read-only rather than a lockout: refusing someone access to snippets they wrote is hostile and
reversible in one click anyway. It removes the reason to keep coasting unverified without taking
anything away.

### Account lifecycle

| When | Condition | Action |
|---|---|---|
| Day 7 | nothing beyond the seeded starter content | Deleted, no warning |
| Day 7 | has real user content | Read-only, plus a reminder email |
| Day 83 | still unverified | Warning email naming the deletion date |
| Day 90 | still unverified | Deleted |

The clock runs on how long the account has been unverified, not on inactivity: once an account is
read-only, activity stops meaning much, and one clock is easier to explain and to test.

Every new account is seeded with two collections and twelve items at registration, so "an empty
account" does not exist and cannot be the test. The signal is whether the user has created, edited
or deleted anything **beyond the seed**.

### The work

- Remove the login gate in `auth.ts`.
- A write guard in the mutating actions, following the shape `canUseAi` and the Pro limit checks
  already use.
- Gate billing and the AI actions behind verification. That is the whole outward-facing surface:
  there are no invites, no sharing, no public content and no bulk import, so the gated set is far
  smaller here than the pattern usually implies.
- A persistent banner carrying the resend control.
- Extend the nightly sweep from one rule to four, with a `deletionWarningSentAt` column so a warning
  is not re-sent every night, and two new emails.
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

### Open decision

The gated set is scoped to billing and the AI actions. Widen it here if anything else should require
a proven address.
