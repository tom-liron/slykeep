# Stripe Phase 1 — Core Infrastructure

## Overview

Everything the Stripe integration needs *before* a single Stripe API call is made: the SDK, the
configuration, the lazily-built client, the types, the free-tier usage-limit rules with their unit
tests, and the proxy exclusion the webhook will depend on in Phase 2.

Nothing in this phase talks to Stripe over the network and nothing renders. All of it is verifiable
with `npm test`, `npm run lint`, and `npm run build` — no Stripe CLI, no dashboard account, no
webhook forwarding. That is the line the two phases are split on.

Reference: `docs/stripe-integration-plan.md` — §2.1, §3.1–3.3, §3.7, §5.1. The code in that document
is the intended implementation; this spec is the scope and the order.

## Requirements

### Dependency and environment

- `npm install stripe`. Not currently a dependency of any kind. `@stripe/stripe-js` is deliberately
  **not** installed — Checkout is Stripe-hosted, the session is created server-side, and the browser
  is redirected to `session.url`, so there is no client-side Stripe.
- Document the Stripe block in `.env.example`. The five names are already there and already
  uncommitted (`M` in git status); every other block in that file carries a comment and this one
  does not. Two things need saying: the webhook secret differs between `stripe listen` and the
  deployed endpoint (plan §8.6, the routine hour-long confusion), and `STRIPE_PUBLISHABLE_KEY` is
  unread by this integration — either drop it or mark it deliberately unread, the way
  `R2_PUBLIC_URL` already is.

### `src/lib/stripe.ts`

- `import "server-only"` at the top, despite living in `lib/`. `lib/` is client-reachable —
  components import `@/lib/format` and `@/lib/utils` — and the secret key must never reach a bundle
  the browser can read. Same reasoning `rate-limit.ts` and `r2.ts` both already state.
- Lazily-constructed singleton `stripe()`, matching `r2()` and `resend()` exactly. Not a
  module-level `new Stripe(...)`: `next build` evaluates server modules while collecting page data,
  and a top-level construction would make the secret key a build-time requirement.
- **Pin `apiVersion`.** Read `Stripe.LatestApiVersion` off the installed package at install time
  rather than copying a version string out of the plan or a blog post. An unpinned integration
  silently adopts whatever version the account is defaulted to, which is how a dashboard setting
  becomes a production incident.
- `billingOrigin()` — the origin Stripe redirects back to, read from `AUTH_URL` rather than a new
  variable and rather than the request's own host. It is already the deployment's canonical origin
  for NextAuth's callbacks and for `lib/email.ts`'s links; a second name for the same value is a
  second thing to get wrong in production.

### `src/config/billing.ts`

- `priceIdFor(cycle)` — maps a `BillingCycle` to its Stripe Price id, reading `process.env` inside
  the function for the same lazy reason as above, and throwing a named error when unset.
- `cycleForPriceId(priceId)` — the inverse, for the webhook. Returns `null` for anything that
  matches neither configured price.
- `ENTITLING_STATUSES` — the subscription statuses that grant Pro: **`active`, `trialing`, and
  `past_due`**. Decided 2026-08-17; `docs/stripe-integration-plan.md` §3.2 carries the same set and
  the reasoning in comment form.

  `past_due` is in because it is a **grace period**, not a cancellation. When a payment fails Stripe
  does not cancel — it marks the subscription `past_due` and retries for roughly three weeks,
  emailing the customer, before giving up and moving it to `canceled`. Almost all of those failures
  are an expired card rather than someone leaving, and revoking file uploads the same day punishes a
  paying customer for something their bank did — which is how a card update turns into a
  cancellation. The abuse case (deliberately killing a card to buy three free weeks) costs $8 and is
  rare.

  The revocation still happens; it happens when Stripe gives up, because `canceled` is not in the
  set. Nothing extra is needed to make that work — the subscription's status transition is what the
  webhook already syncs.
- Reuse `BillingCycle` from `src/config/marketing.ts:88`. Do not declare a second enum for the same
  two values.

### Database

- Add `stripePriceId String?` and `stripeCurrentPeriodEnd DateTime?` to `User` in
  `prisma/schema.prisma`, then generate a migration with `npm run db:migrate`. **Never `db push`.**
- `isPro`, `stripeCustomerId`, and `stripeSubscriptionId` already exist and are already applied
  (`prisma/migrations/20260714112951_init/migration.sql:15-17`). Nothing else is needed to ship a
  working checkout — these two columns exist only so the settings panel can say "Pro — annual" and
  "renews on 3 September" without a Stripe round trip on every page view.
- Both nullable, so no backfill.

### Types

- `src/types/billing.ts` — `BillingActionResult`, the failure arm only. The success path of both
  Phase 2 actions is a `redirect()` to Stripe, which throws, so there is no success value to read.
  Lives in `types/` rather than beside the actions for the reason `types/account.ts` states: a
  `"use server"` module may only export async functions.
- `BillingViewModel` in `src/types/view-models.ts` — `isPro`, `cycle`, `currentPeriodEnd` (ISO
  string, serialized at the server boundary like every other date in that file), `hasCustomer`.

### Usage limits — `src/lib/limits.ts`

The free tier is **50 items** and **3 collections** (`project-overview.md` §7). Neither has any code
today; `src/actions/collections.ts:44-47` says so in a comment that names this exact work.

- Extend the existing `src/lib/limits.ts` rather than creating a new module. `canAccessItemType`
  already lives there and the new rules are the same kind of thing — one file, one concern.
- `FREE_ITEM_LIMIT = 50`, `FREE_COLLECTION_LIMIT = 3`.
- `canCreateItem(userIsPro, currentCount)` and `canCreateCollection(userIsPro, currentCount)`, both
  keeping `canAccessItemType`'s short-circuit on `ENFORCE_PRO_LIMITS`.
- **Take the count as an argument; do not query.** Keeping these pure is what makes them testable
  without a database, and it is the shape `canAccessItemType` already has. The `count()` call
  belongs at the call site, which is Phase 2.
- Nothing is wired to them in this phase. They are dead code until Phase 2 calls them, and that is
  intentional — it is what lets the rules be tested and reviewed on their own.

### Unit tests

Vitest, beside the module, per `coding-standards.md`.

- Extend `src/lib/limits.test.ts` (it exists): `canCreateItem` and `canCreateCollection` at the
  boundaries — 49 / 50 / 51 and 2 / 3 / 4 — Pro always true, and every case true while
  `ENFORCE_PRO_LIMITS` is false.
- New `src/config/billing.test.ts`: `cycleForPriceId` returns `"monthly"`, `"yearly"`, and `null`
  for an unknown id; returns `null` rather than throwing when the env var is unset. `priceIdFor`
  throws a named error when unset. `ENTITLING_STATUSES` contains `active`, `trialing`, **and
  `past_due`** — and not `canceled`, `unpaid`, or `incomplete`. Assert `past_due` explicitly rather
  than leaving it to the "not in the set" case: it is the one member that looks like a mistake to a
  future reader, so the test is where the grace-period decision is recorded in code.

### `src/proxy.ts` — the webhook exclusion

- Add `api/stripe/webhook` to the matcher's negative lookahead at `src/proxy.ts:61`, with a comment
  giving the same reasoning the file already gives for `api/auth`.
- **The webhook path only — not `api/stripe`.** Checkout and the portal are session-authenticated
  and must stay behind the proxy.
- Landing this in Phase 1 is deliberate. The proxy denies by default, so without it Stripe's `POST`
  gets a 302 to `/sign-in`, Stripe records every delivery as failed, retries with backoff for days,
  and eventually disables the endpoint — and the route handler is never invoked, so it fails
  completely silently from the app's side. Shipping the exclusion before the route that needs it
  removes the possibility of debugging that.

### `src/lib/rate-limit.ts`

- Add `checkout: { tokens: 10, window: "10 m", keyBy: "user" }` to `LIMITS`.
- Follows the `upload` precedent rather than the auth ones: the caller is behind the session, so
  what this bounds is cost — a Stripe API call and a Customer row per attempt — not anonymity.

## Verification

- `npm test` — the two test files above pass.
- `npm run db:status` — migration applied and in sync.
- `npm run lint` and `npm run build` — the build is the real check on `src/lib/stripe.ts`, since the
  whole point of the lazy client is that a machine with no `STRIPE_SECRET_KEY` can still build.
- `grep -r "STRIPE_SECRET" .next/static` after the build → no hits. `import "server-only"` should
  make this impossible, but it is a two-second check on a secret worth money.

## Out of scope

Everything that needs a Stripe account, the Stripe CLI, or a rendered page — all of it is Phase 2:

- The webhook route handler itself (the matcher exclusion ships here; the route does not).
- `src/server/billing.ts`, `src/actions/billing.ts`, the settings billing panel.
- Wiring `canCreateItem` / `canCreateCollection` into `createItem` and `createCollection`.
- Account-deletion gating.
- Flipping `ENFORCE_PRO_LIMITS`.

## Notes

- **Decided 2026-08-17, before implementation:** a failed card keeps Pro for the length of Stripe's
  retry window (`past_due` entitles). The other two decisions this integration was carrying are
  recorded in the Phase 2 spec — hard block at the free-tier cap, and `ENFORCE_PRO_LIMITS` stays
  `false` until launch. Nothing in either phase is waiting on an answer any more.
- **No source file behaves differently at the end of this phase.** The proxy exclusion opens a path
  that has no route on it, the limit functions have no callers, and the Stripe client is never
  constructed. That is the intended end state: it is a phase of foundations, and the review surface
  is small because of it.
- Stripe dashboard setup (product, two prices, portal configuration, webhook endpoint) is **not**
  needed for this phase — nothing here makes an API call. It is Phase 2's prerequisite, and the
  steps are written out in `docs/stripe-integration-plan.md` §8. Doing it early costs nothing and
  unblocks Phase 2 immediately.
- One branch, `feature/stripe-core-infrastructure`, and the ordering within it matters in one place
  only: the proxy change before anything that would tempt someone to test a webhook.
