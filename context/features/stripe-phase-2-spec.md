# Stripe Phase 2 — Integration & UI

## Overview

Everything that talks to Stripe or renders: the webhook that grants and revokes Pro, the checkout
and portal actions, the settings billing panel, the account-deletion gate that stops a departing
subscriber being billed forever, and the free-tier count checks at the write boundary.

This is the phase that needs the Stripe CLI. The webhook cannot be verified any other way —
signature verification, idempotency on replay, and the unknown-customer path all require
`stripe listen` and `stripe trigger`, and the cancel-then-delete case needs a Stripe **test clock**
rather than a month of waiting.

Depends on **Phase 1** (`context/features/stripe-phase-1-spec.md`) being merged: the Stripe client,
`config/billing.ts`, the two new `User` columns, the view-model types, the proxy exclusion, the
`checkout` rate limit, and the usage-limit functions this phase calls.

Reference: `docs/stripe-integration-plan.md` — §3.4–3.6, §3.8, §4, §5, §6, §8, §10.

## Prerequisite — Stripe Dashboard

Do this before writing code; `billingPortal.sessions.create` fails outright with a configuration
error until step 4, which is a confusing way to discover it. Full steps in the plan's §8.

1. Product **DevStash Pro**, with **two recurring prices on that one product** — $8/month and
   $72/year. One product with two prices is what lets the portal offer a monthly↔yearly switch; two
   products cannot do it.
2. Price ids → `STRIPE_PRICE_ID_MONTHLY` / `STRIPE_PRICE_ID_YEARLY`. Secret key (test mode) →
   `STRIPE_SECRET_KEY`.
3. Configure the **Customer portal**: cancel subscription, update payment method, switch plan (list
   both prices), invoice history.
4. `stripe listen --forward-to localhost:3000/api/stripe/webhook` — its `whsec_…` is a *different*
   secret from the dashboard endpoint's, and it is the one that goes in local `.env`.
5. Repeat in live mode before launch. Price ids, keys, and webhook secrets are all mode-specific.

## Requirements

### `src/server/billing.ts`

Server-only. `server/` owns reads and view-model preparation; the subscription sync lives here
rather than in `actions/` because a webhook is not a user-initiated mutation and has no form to
answer.

- `getOrCreateCustomerId()` — creates the Stripe Customer **before** checkout rather than letting
  Checkout create one. `checkout.session.completed` carries metadata, but the later
  `customer.subscription.updated` and `.deleted` events carry a customer id and nothing else, so
  without a `stripeCustomerId` already on the row a cancellation three months from now has nothing
  to match against. Write the column before opening checkout, so an abandoned attempt leaves one
  customer rather than minting a new one each time.
- `syncSubscriptionState(customerId)` — **reads the subscription back from the Stripe API rather
  than trusting the event payload.** Webhooks are delivered at least once and in no guaranteed
  order; deriving state from "whatever Stripe says is true right now" makes replays, duplicates, and
  out-of-order deliveries all harmless, and makes the handler idempotent by construction. No event
  log, no processed-id table.
  - Use `updateMany`, not `update`. A webhook can name a customer this database has never heard of —
    one created by hand in the dashboard, or one belonging to a deleted account — and `update`
    throws P2025 on no match, answering Stripe with a 500 and earning an endless retry of an event
    there is nothing to do about.
  - Read the period end from `subscription.items.data[0].current_period_end`. Stripe's
    `2025-03-31.basil` release **removed `current_period_start` / `current_period_end` from the
    Subscription resource** and moved them onto subscription items. Every pre-2025 example — course
    material included — reads it off the subscription, where it now types as an error or reads
    `undefined`.
- `getBillingSummary()` — builds `BillingViewModel` from the local row. Presentation reads local
  state deliberately; only the deletion gate below pays for a Stripe round trip.
- `hasBillableSubscription(userId)` and `endBillingRelationship(userId)` — see the deletion gate
  below.

### `src/app/api/stripe/webhook/route.ts`

A route handler because it is a webhook — named explicitly in `coding-standards.md`'s list.

- `runtime = "nodejs"` and `dynamic = "force-dynamic"`.
- Read the **raw** body with `request.text()`. `request.json()` re-serializes it, and one reordered
  key or changed byte of whitespace invalidates the signature. This is the single most common way
  this handler is got wrong.
- Verify with `constructEventAsync`. The signature is the only authentication this endpoint has —
  the URL is public and the payload is attacker-controlled until verification passes. Failure is a
  **400** with nothing read.
- Handle four events: `checkout.session.completed`, `customer.subscription.created`, `.updated`,
  `.deleted`. All four route through the one `syncSubscriptionState` call. `invoice.payment_failed`
  is deliberately absent — it changes no entitlement on its own, the subscription's *status* does.
- Unhandled event type → **200**, not an error. Anything else earns a retry of something that will
  never be handled.
- Sync failure → **500**, so Stripe retries. A database blip must not silently cost someone the Pro
  they paid for, and the sync being idempotent is what makes the retry safe.
- Missing `STRIPE_WEBHOOK_SECRET` → 500, not 200. An unconfigured deployment that acknowledged
  events would drop every subscription change in the gap.

### `src/actions/billing.ts`

Server Actions by `project-overview.md` §9's rule — neither caller needs an HTTP status; success is
a `redirect()` the action performs itself and failure is a string for a toast.

- `startCheckout(cycle)` — rate-limited on the `checkout` limit added in Phase 1. **The cycle is the
  only thing the payload is trusted with**, mapped to a Price id via `priceIdFor` rather than
  accepted as one; a payload naming a price directly would let a caller check out against any price
  in the account, including a $0 one. Same rule `createItem` follows for item types.
- `openBillingPortal()` — `billingPortal.sessions.create`, returning to `/settings`. Cancel, switch
  plan, update card, and invoices are all Stripe's UI by choice: every one of those flows has edge
  cases (proration, dunning, tax) that are not this product's problem to solve.
- Both: `redirect()` goes **outside** the `try`. It works by throwing, and a catch would swallow it
  and report a failure for a session that was created successfully. This is the same shape
  `deleteAccount` already documents for `signOut`.

### Settings billing panel

- `src/app/(dashboard)/settings/page.tsx` — add a `<Panel id="billing">` above Account. The file's
  own comment already says *"Billing and export are the next two, and each becomes another Panel"*.
- `src/components/settings/BillingPanelRows.tsx` — client component for the pending state and
  toasts, rendering inside the server-drawn `Panel`. Same split `EditorPreferencesRows` uses.
  - Free: a "Free plan" row and an upgrade row with the two cycle buttons.
  - Pro: plan name, renewal date via `formatLongDate`, and **Manage subscription**.
  - Both actions only ever *return* on failure, so the handler toasts on any returned value.
- `?checkout=success` lands on a fresh server-rendered request, so `getCurrentUser()` reads the new
  `isPro` directly — no session work needed. The one genuine race is checkout completing before the
  webhook lands; handle it in the UI with "Your upgrade is being confirmed…" and one delayed
  `router.refresh()`, not in the session.
- **Do not touch `src/auth.ts`.** Nothing reads `isPro` from the session — every gate goes through
  `getCurrentUser()`, which reads it from Postgres per request and is React-`cache`d, so a webhook
  write is authoritative on the very next request. The JWT sync proposed in the research prompt
  would add a second Postgres query per request to feed a token field nothing reads. Plan §7 has the
  full reasoning and the version to use *if* a client component ever needs it.

### Account deletion gate — the money defect

Today `deleteAccount()` (`src/actions/account.ts:105`) is one `prisma.user.delete`. Once Stripe is
live, that becomes a defect that charges money: the row holding `stripeCustomerId` is gone, the
subscription in Stripe is untouched, the card keeps being billed, and **nothing in the system can
find it afterwards** — the only pointer was in the row that was deleted.

The decided policy (plan §6): **cancelling and deleting are two separate controls, and deletion is
refused while a subscription would still bill.** The app never ends a paid subscription on the
user's behalf; the person who bought it ends it, in Stripe's own UI, where it is confirmed on screen
and by email.

- `hasBillableSubscription(userId)` **asks Stripe, not the local row.** `isPro` is only as fresh as
  the last webhook that landed — a missed delivery leaves the row saying "free" for an account
  Stripe is still billing, and that stale case is precisely the case the gate exists to catch. One
  API call, on an action a user performs approximately once in their life. No `stripeCustomerId` →
  `false` with no API call at all, which is the common path.
- The gate is **"will bill again"**, not **"status is active"**:
  `ENTITLING_STATUSES.has(status) && !cancel_at_period_end`. The portal cancels at period end by
  default, so someone who cancels on 20 March with a 5th-of-the-month billing date sits at status
  `active` with `cancel_at_period_end: true` until 5 April. A naive `status === "active"` check
  would refuse their deletion for sixteen more days — punishing them for doing exactly what they
  were told. **This has a dedicated regression test below.**
- `deleteAccount` refuses with a message routing to Settings → Billing, then on the allowed path
  calls `endBillingRelationship` (best-effort, `.catch` and log) *before* `prisma.user.delete`,
  because the cascade destroys the only copy of `stripeCustomerId`. The cleanup is not load-bearing:
  the gate has already established nothing will bill, so a Stripe outage must not stop someone
  leaving. `signOut` stays outside the `try`, as it already is.
- `endBillingRelationship` uses `customers.del()` rather than `subscriptions.cancel()` — it removes
  the stored card, which a bare cancellation leaves attached to someone with no account, and it
  catches any subscription on the customer rather than only the one the row tracked.
  `resource_missing` is success, not an error.
- **Not redaction.** `customers.del()` on self-service deletion; a Stripe redaction job only on an
  explicit GDPR/CCPA erasure request, which is a different event with different retention rules.
- UI: `AccountSettingsViewModel` gains `isPro` (**no new query** — `getAccountSettings()` already
  resolves through `getCurrentUser()`, which selects it), `src/server/profile.ts:69` returns it, and
  `DeleteAccountDialog` takes it. For a subscriber the dialog does not offer the typed-email
  confirmation at all: it explains the subscription must be cancelled first and renders a button
  opening the portal. **The refusal has to be a route, not a wall** — a dialog that says "you can't
  do this" and stops is the dark pattern this design is otherwise avoiding. The server-side refusal
  stays regardless; the dialog is the convenience, the action is the control.

### Feature gating at the write boundary

- `src/actions/items.ts` (in `createItem`, after the Zod parse, before the write) — `getCurrentUser()`
  for `isPro`, `prisma.item.count({ where: { userId } })`, then `canCreateItem`. That count is
  already the exact query `src/server/profile.ts` runs, so the shape is established.
- `src/actions/collections.ts` (in `createCollection`, ~:50) — the same with `canCreateCollection`,
  and **replace the `:44-47` comment** that says this is Phase 6 work. It names this exact change.
- **Write boundary only, deliberately.** The UI should *show* the cap — the profile page already
  renders both totals — but the action is the authority, the same division `contentType` follows.
- **A race exists and is accepted.** Two concurrent creates can both read 49 and both write. Closing
  it needs a transaction with a re-count on the hottest write path, which is not worth it for a
  50-item soft cap — but it should be a conscious decision, not an unnoticed one.
- **Hard block**, with an upgrade-flavoured error toast. Decided 2026-08-17; `project-overview.md`
  §11 listed "upgrade prompt vs hard block" as open and this closes it. The save fails and the
  message names the cap and the way out.

  The pricing page already promises "Up to 50 items", so a 51st that succeeds makes the number
  decoration — and then 60, 200, and 2000 all need an answer too. The nag alternative also needs
  design work (where the banner lives, when it stops) that has nothing to do with Stripe.

### Marketing CTA

- `src/config/marketing.ts:173` — the Pro CTA `href` currently sends everyone to `/register`, and
  the comment at `:145` says "No checkout exists yet (Phase 6)". Point it at `/settings#billing` and
  drop the comment.
- The marketing page is only served without a session, so a signed-out visitor still has to register
  first. `/register?plan=pro` plus a post-registration redirect is the fuller version; either is
  acceptable, but pick one deliberately rather than leaving a link that bounces.

### `ENFORCE_PRO_LIMITS` stays `false` — decided, and therefore *not* in this phase

`src/config/access.ts:5` is **not touched by this work.** Decided 2026-08-17: the switch flips at
launch, not as part of the Stripe integration.

- The integration is complete and fully testable with it off. Checkout, the webhook, the portal, the
  deletion gate, and the count checks all work and are all verifiable; the flag only decides whether
  the gates *refuse* anyone.
- Flipping it now costs something immediately: your own development account loses the file and image
  types the same moment, unless `isPro` is set by hand on that row. A daily annoyance for no benefit
  while the product has no paying users.
- When it does flip, it is one line in its own commit, trivially revertable. It changes behaviour at
  five existing call sites this work never touches (`src/server/item-types.ts:70`,
  `src/server/items.ts:250`, `src/app/api/upload/route.ts:55`, `src/actions/items.ts:97-101`, and
  the sidebar badge) plus the two new count checks — which is exactly why it should be alone.
- Note for that day: flipping it on a database where an account already holds 200 items blocks new
  creates but deletes nothing. That is the intended behaviour, not a bug to fix under pressure.

## Testing

### Webhook (`stripe listen` running)

- [ ] Valid signature → 200, `isPro` true in the database.
- [ ] Tampered body → **400**, database untouched.
- [ ] Missing `stripe-signature` header → 400.
- [ ] **Replay the same event twice** → same final state, no error. This is the idempotency claim.
- [ ] Event for a customer id not in the database → 200, no throw (the `updateMany`).
- [ ] `stripe trigger customer.subscription.deleted` → `isPro` false, `stripeSubscriptionId` null.
- [ ] With the Phase 1 proxy exclusion reverted → confirm the 3xx. Worth seeing once so the failure
      mode is recognisable if it ever recurs.

### Account deletion

- [ ] Free account, no `stripeCustomerId` → deletes exactly as today, **no Stripe call made**.
- [ ] Active subscription → refused, and the dialog offers the portal rather than the typed-email
      confirmation.
- [ ] **The one that matters:** cancel in the portal, then immediately attempt deletion. The
      subscription is still `active` with `cancel_at_period_end: true`, and deletion must
      **succeed**. This is the regression test for the `status === "active"` mistake.
- [ ] Stale local state: set `isPro = false` by hand on a row whose Stripe subscription is live →
      still refused, because the gate asks Stripe.
- [ ] Period elapses (Stripe **test clock**) → subscription `canceled`, deletion succeeds, no
      further invoice.
- [ ] Cleanup failure is non-fatal: delete the customer by hand in the dashboard, then delete the
      account → succeeds, `resource_missing` swallowed.
- [ ] `customer.subscription.deleted` arrives after the row is gone → 200, no throw.

### End-to-end

This is the *multi-step end-to-end territory* `context/ai-interaction.md` names as the narrow case
where driving the browser is warranted — failures invisible to unit tests and tedious to reproduce
by hand.

- [ ] Free → Settings → `$8 / month` → Checkout → `4242 4242 4242 4242` → back on `/settings`, panel
      says Pro.
- [ ] Sidebar now shows Files and Images; `/items/files` loads; an upload succeeds.
- [ ] `$72 / year` produces the annual price on the Stripe page.
- [ ] Cancel checkout → `?checkout=cancelled`, still free, no orphaned state.
- [ ] Portal → cancel → return → Pro revoked (may need one refresh for the webhook).
- [ ] Portal → switch monthly → yearly → cycle and renewal date both update.
- [ ] Declining card `4000 0000 0000 0341` → subscription lands `past_due` → **still Pro.** This is
      the grace period decided in Phase 1, and it is the assertion that proves it: the account keeps
      file uploads while Stripe retries.
- [ ] Drive that subscription to `canceled` with a **test clock** (rather than waiting out three
      weeks of real retries) → Pro revoked. The grace period has to end somewhere, and this is the
      only check that shows it does.
- [ ] Flip `ENFORCE_PRO_LIMITS` to `true` **locally and temporarily** to exercise the count checks:
      a free account at 50 items is blocked, the same account after upgrading is not. **Revert
      before committing** — the flag ships `false`.

### Security

- [ ] `startCheckout` called with a price id instead of a cycle → rejected by the type and by
      `priceIdFor` at runtime.
- [ ] Two accounts: A's `stripeCustomerId` cannot be reached from B's portal action.
- [ ] The webhook route is the *only* thing excluded from the proxy — confirm nothing else slipped
      into the lookahead.

## Out of scope

- **Flipping `ENFORCE_PRO_LIMITS`** — a launch task, not an integration one. See the section above.
- AI and export gating — Phase 5 and Phase 4 respectively, no code to gate yet.
- Custom item types (Phase 7).
- Dunning email copy, and any revisit of `past_due` that depends on it.
- Soft delete / trash view (`project-overview.md` §11).
- The R2 orphan on account deletion. It is the identical "read what you need before the cascade
  destroys it" shape as the Stripe half and it is *not* fixed here — worth folding into the same
  commit if the appetite is there, since it is the same three lines in the same function, but it is
  a separate decision.

## Notes

- **The deletion gate ships in the same release as checkout, not later.** Checkout is what first
  lets a real card be charged; every day between the two is a day a deletion can strand a live
  subscription with no way to find it again.
- The settings panel says "Renews on…" even for a subscription that is cancelling. Reading
  `subscription.cancel_at_period_end` into the view model and saying "Ends on…" is the fix — small,
  and worth doing while the surrounding code is open.
- Suggested commit split on one branch: server + webhook, then actions + panel, then the deletion
  gate, then the count checks. Four commits — `ENFORCE_PRO_LIMITS` is not among them.
- **The three decisions this integration was carrying are all settled (2026-08-17)** and written
  into the specs where they act, so implementation should not have to stop and ask: `past_due`
  entitles (Phase 1), the free-tier cap hard-blocks (above), and the master switch stays `false`
  until launch (above).
