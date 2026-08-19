# Current Feature: In-app upgrade path

## Feature

A free account signed into the app has no way to reach checkout except Settings → Billing, or
clicking a locked item type. And the pricing comparison it would want first is unreachable: the
marketing page that renders `PRICING_PLANS` is only served **without** a session, so the moment
someone registers, those cards are gone.

Two additions: a subtle Upgrade control in the top bar, and a `/upgrade` page inside the dashboard
that renders the same comparison the landing page does, with both cycle buttons going straight to
Stripe.

## Status

Not Started

## Goals

- **Ghost `Upgrade` button in the top bar, free accounts only.** `getSidebarNav()` already returns
  the user, so `(dashboard)/layout.tsx` has `nav.user.isPro` in hand — pass it to `TopBar` rather
  than adding a query or a session claim. Ghost variant deliberately: it must not compete with
  *New item* and *New collection*, which are the bar's real actions.
- **`/upgrade` under `(dashboard)`** — the plan comparison, built from `PRICING_PLANS` and
  `BILLING_CYCLES` in `config/marketing.ts`. No second copy of the prices or the feature lists.
- **The Pro card's control calls `startCheckout(cycle)`**, not a link — the marketing card's
  `cta.href` is for a signed-out visitor. The cycle switch drives which price is bought.
- **A Pro account that lands on `/upgrade`** is sent to `/settings#billing`, which is the page that
  can actually do something for them.
- **`ProTypeUpgrade` stays** as the contextual per-type upsell; decide whether its button now points
  at `/upgrade` rather than `/settings#billing`.
- Gate: `npm test`, `npm run lint`, `npm run build`.

## Notes

- **Do not put `isPro` in the session.** The course's version does, which is why it needs
  `?upgraded=true` plumbing — a JWT claim goes stale the moment the webhook flips the column. Every
  gate here reads `getCurrentUser()`, which is React-`cache`d per request, so a webhook write is
  authoritative on the very next render. `docs/stripe-integration-plan.md` §7.
- The existing `components/marketing/PricingPlans.tsx` is a *landing page* component — `Reveal`
  scroll animations, `SectionHeading` eyebrows, its own section padding. Reuse the **config**, and
  judge at implementation time whether the component itself belongs inside the app shell or whether
  the dashboard wants a plainer rendering of the same data.
- Checkout stays a Server Action behind the `checkout` rate limit, called from wherever. No second
  entry point to Stripe.
- Free-tier caps and the file/image gate are unchanged; this feature only adds ways to *reach*
  checkout, never new ways past a gate.

## History

Moved to `context/feature-history.md`, which is **not** `@`-imported — this file is loaded into
every session and the history is not needed in most of them. `/feature complete` appends there.
