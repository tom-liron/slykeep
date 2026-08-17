# Stripe Integration Plan — DevStash Pro

> Research output for `context/research/stripe-integration-research.md`.
> Documentation only: nothing here has been implemented, no branch was created, no source file was
> modified.
>
> **The operative documents are now the two feature specs** — `context/features/stripe-phase-1-spec.md`
> (core infrastructure, unit-testable, no Stripe account needed) and
> `context/features/stripe-phase-2-spec.md` (webhook, UI, gating, needs the Stripe CLI). This plan
> stays as the reference for the code and the reasoning behind it; the specs carry the scope and the
> order. Three decisions were taken on 2026-08-17 and are folded in below: `past_due` entitles
> (§3.2), the free-tier cap hard-blocks (§5.2), and `ENFORCE_PRO_LIMITS` is held until launch (§9).
>
> Target: Pro at **$8/month** or **$72/year**, Stripe-hosted Checkout, Stripe-hosted Billing
> Portal, webhook-driven entitlement.

---

## 1. Current State

### 1.1 The schema is already there

`prisma/schema.prisma` — `User` already carries every column the basic integration needs, and they
are already applied in the database (`prisma/migrations/20260714112951_init/migration.sql:15-17`,
with unique indexes at lines 136 and 139):

```prisma
// Monetization
isPro                Boolean @default(false)
stripeCustomerId     String? @unique
stripeSubscriptionId String? @unique
```

So **Phase 6 needs no migration to ship a working checkout**. It needs one only if you want the two
columns §3.1 argues for (`stripePriceId`, `stripeCurrentPeriodEnd`), which buy the settings page a
renewal date and a plan name without a Stripe API call on every page view.

### 1.2 How `isPro` is read today

There is no `isPro` in the session. The chain is:

| Layer | File | What it does |
|---|---|---|
| Session → user id | `src/server/current-user.ts:19` | `getCurrentUserId()` — `auth()`, then `session.user.id`. React-`cache`d per request. |
| User id → user | `src/server/current-user.ts:34` | `getCurrentUser()` — one Prisma read selecting `{ id, name, email, image, isPro }`. Also `cache`d. |
| View model | `src/server/view-models.ts:255` | `buildUserViewModel` carries `isPro` onto `UserViewModel`. |
| Gate | `src/lib/limits.ts:7` | `canAccessItemType(userIsPro, itemTypeIsPro)`. |

**This matters for §7 (the JWT question).** `isPro` is read from Postgres on every request that
needs it, not from the token. A webhook that flips the column is therefore visible to every
server-side gate on the very next request, with no session refresh of any kind.

The JWT callback (`src/auth.ts:141-152`) carries `token.id` only — note this is `token.id`, **not**
`token.sub`, which is what the research prompt's snippet assumes.

### 1.3 Where the gates already are

| Call site | File | Gate |
|---|---|---|
| Item-type nav | `src/server/item-types.ts:70` | filters Pro types out of the sidebar |
| Item-type page | `src/server/items.ts:250` | refuses the `/items/files` page |
| Upload route | `src/app/api/upload/route.ts:55` | 403 before writing to R2 |
| Item create | `src/actions/items.ts:97-101` | re-checks at the write boundary |
| Sidebar badge | `src/components/layout/SidebarNav.tsx:81,245` | `<ProBadge />`, deliberately non-blocking |

All of them route through `canAccessItemType`, which is short-circuited by
`ENFORCE_PRO_LIMITS = false` in `src/config/access.ts:5`. **One constant is the master switch.**

### 1.4 What does *not* exist yet

- No `stripe` package (`package.json` has no Stripe dependency of any kind).
- No `src/lib/stripe.ts`, no `src/app/api/stripe/`, no `src/actions/billing.ts`,
  no `src/server/billing.ts`, no billing UI.
- No count-based limits. `src/actions/collections.ts:44-47` says so explicitly in a comment:
  *"Nothing here caps how many collections an account may hold. The free tier's limit of three is
  Phase 6 work…"*
- The env var **names** are already committed to `.env.example` (uncommitted `M` in git status) and
  set in `.env`:
  `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_YEARLY`.

---

## 2. Three things that will bite, found in the codebase

These are the findings worth reading before the file list.

### 2.1 ⚠️ The proxy will eat the webhook

`src/proxy.ts:61` is **deny-by-default**:

```ts
export const config = {
    matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

`POST /api/stripe/webhook` arrives from Stripe with no session cookie. It is not in
`SIGNED_OUT_ROUTES`, not in `OPEN_ROUTES`, and not `/` — so the proxy answers
`Response.redirect("/sign-in")`. Stripe sees a 3xx, records the delivery as failed, retries with
backoff for days, and **eventually disables the endpoint**. The route handler is never invoked, so
this fails completely silently from the app's side.

The fix is one string, and it must be **the webhook path only** — not `api/stripe`. `checkout` and
`portal` are session-authenticated and must stay behind the proxy:

```ts
matcher: ["/((?!api/auth|api/stripe/webhook|_next/static|_next/image|favicon.ico).*)"],
```

This is the same reasoning the file's own comment already gives for `api/auth`, and it deserves a
comment saying so.

### 2.2 `current_period_end` is not on the Subscription any more

Stripe's `2025-03-31.basil` API version **removed `current_period_start` / `current_period_end`
from the Subscription resource** and moved them onto subscription *items*
([changelog](https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end)).
`stripe-node` v18+ defaults to Basil or later. Every tutorial written before mid-2025 — including
most course material — reads `subscription.current_period_end`, which now types as an error or
reads `undefined`.

Read it from the first item instead:

```ts
const periodEnd = subscription.items.data[0]?.current_period_end;
```

Also from that same release: **Checkout Sessions in subscription mode no longer create the
subscription until payment completes.** `checkout.session.completed` for a paid session does carry
`session.subscription`, but do not assume a subscription exists before that event.

### 2.3 The publishable key is dead weight

`STRIPE_PUBLISHABLE_KEY` is already in `.env.example`, but Stripe-hosted Checkout needs no
client-side Stripe at all — you create the session server-side and redirect the browser to
`session.url`. Nothing in this plan reads it, and `@stripe/stripe-js` is not a dependency.

Either drop it, or keep it with a comment saying it is deliberately unread — which is the pattern
`.env.example` already established for `R2_PUBLIC_URL`.

---

## 3. Files to Create

### 3.1 `prisma/migrations/<timestamp>_add_subscription_state/` *(optional but recommended)*

Two columns, so the settings page can say "renews on 3 September" and "Pro (annual)" without an API
round trip:

```prisma
model User {
  // ... existing
  stripeCustomerId       String?   @unique
  stripeSubscriptionId   String?   @unique
  stripePriceId          String?   // which of the two prices — monthly or yearly
  stripeCurrentPeriodEnd DateTime? // when the current paid period ends
}
```

Generated with `npm run db:migrate` (never `db push` — `project-overview.md` §5). Both nullable, so
existing rows need no backfill.

**If you skip this**, `isPro` alone is enough to gate the product; the billing panel then shows
"Pro" and a "Manage subscription" button and nothing else. That is a legitimate smaller first cut.

---

### 3.2 `src/config/billing.ts`

Runtime configuration satisfying compile-time contracts — the `types/` vs `config/` split in
`coding-standards.md`. Reuses `BillingCycle` from `src/config/marketing.ts:88` rather than declaring
a second enum for the same two values.

```ts
import type { BillingCycle } from "./marketing";

/**
 * Which Stripe Price each billing cycle checks out against.
 *
 * Read through a function rather than a module-level constant, for the reason `lib/r2.ts` and
 * `lib/email.ts` both build their clients lazily: `next build` evaluates server modules while
 * collecting page data, and a top-level read that throws on a missing key would fail the build on
 * any machine holding only the public config.
 *
 * The *display* prices live in `config/marketing.ts` and are deliberately not derived from Stripe.
 * The pricing table is marketing copy on a page a signed-out visitor is served; fetching two Price
 * objects to render it would put a network call on the landing page's critical path to display two
 * numbers that change roughly never.
 */
export function priceIdFor(cycle: BillingCycle): string {
    const id =
        cycle === "yearly"
            ? process.env.STRIPE_PRICE_ID_YEARLY
            : process.env.STRIPE_PRICE_ID_MONTHLY;

    if (!id) {
        throw new Error(
            `Stripe is not configured — set STRIPE_PRICE_ID_${cycle === "yearly" ? "YEARLY" : "MONTHLY"}.`,
        );
    }

    return id;
}

/** The inverse, for the webhook: which cycle a Price id represents. `null` for anything else. */
export function cycleForPriceId(priceId: string | null | undefined): BillingCycle | null {
    if (!priceId) return null;
    if (priceId === process.env.STRIPE_PRICE_ID_MONTHLY) return "monthly";
    if (priceId === process.env.STRIPE_PRICE_ID_YEARLY) return "yearly";
    return null;
}

/**
 * Subscription statuses that entitle an account to Pro.
 *
 * `past_due` is in, deliberately, and it is the one entry that looks like a mistake: it means a
 * payment has failed. Stripe does not cancel on a failed payment — it retries for roughly three
 * weeks, emailing the customer, and only then moves the subscription to `canceled`. Almost all of
 * those failures are an expired card rather than someone leaving, so revoking file uploads the same
 * day punishes a paying customer for something their bank did, which is how a card update becomes a
 * cancellation. The abuse case — killing a card on purpose to buy three free weeks — costs $8.
 *
 * Access still ends; it ends when Stripe gives up, because `canceled` is not in this set. The
 * webhook already syncs that transition, so the grace period needs no code of its own.
 */
export const ENTITLING_STATUSES = new Set(["active", "trialing", "past_due"]);
```

---

### 3.3 `src/lib/stripe.ts`

Follows `src/lib/r2.ts` and `src/lib/email.ts` exactly: `import "server-only"`, lazy client.

```ts
import "server-only";

import Stripe from "stripe";

/**
 * The Stripe client.
 *
 * `import "server-only"` despite living in `lib/`, for the reason `rate-limit.ts` and `r2.ts` both
 * state: `lib/` is client-reachable (components import `@/lib/format`, `@/lib/utils`) and the
 * secret key must never reach a bundle the browser can read. The directive turns a mistaken client
 * import into a build error rather than a leak.
 *
 * Built lazily rather than at module load, so importing this module cannot throw — `next build`
 * evaluates server modules while collecting page data, and a top-level construction would make the
 * key a build-time requirement. Same shape as `r2()` and `resend()`.
 */
let client: Stripe | null = null;

export function stripe(): Stripe {
    if (client) return client;

    const key = process.env.STRIPE_SECRET_KEY;

    if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");

    client = new Stripe(key, {
        // Pinned, not inferred. An unpinned integration silently adopts whatever version the
        // account is defaulted to, which is how a dashboard setting becomes a production incident.
        // Set this to the SDK's own default at install time — read `Stripe.LatestApiVersion` from
        // the installed package rather than copying a version out of a blog post — and change it
        // only alongside a read of that version's changelog.
        apiVersion: "2025-06-30.basil",
        appInfo: { name: "DevStash", url: "https://devstash.dev" },
    });

    return client;
}

/**
 * Origin for the URLs Stripe redirects back to.
 *
 * `AUTH_URL` rather than a new variable, and rather than the request's own host: it is already the
 * deployment's canonical origin for NextAuth's callbacks and for `lib/email.ts`'s links, and a
 * second name for the same value is a second thing to get wrong in production.
 */
export function billingOrigin(): string {
    const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;

    if (!url) throw new Error("AUTH_URL is not set; Stripe return URLs cannot be built.");

    return url.replace(/\/$/, "");
}
```

---

### 3.4 `src/server/billing.ts`

Server-only reads and the one write the webhook needs. `server/` owns reads and view-model
preparation (`project-overview.md` §9); the subscription-sync helper lives here rather than in
`actions/` because the webhook is not a user-initiated mutation and has no form to answer.

```ts
import "server-only";

import type Stripe from "stripe";

import { cycleForPriceId, ENTITLING_STATUSES } from "@/config/billing";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getCurrentUser } from "./current-user";
import type { BillingViewModel } from "@/types/view-models";

/**
 * The signed-in account's Stripe customer, created on first use.
 *
 * A customer is created *before* checkout rather than letting Checkout create one, so the webhook
 * has a stable key to find the user by. `checkout.session.completed` carries metadata, but the
 * later `customer.subscription.updated` and `.deleted` events do not — they carry a customer id and
 * nothing else. Without a `stripeCustomerId` already on the row, a cancellation three months from
 * now has nothing to match against.
 *
 * The email is passed so the Stripe dashboard is legible, and the user id goes in metadata so a
 * Customer can be traced back even if the column is somehow lost.
 */
export async function getOrCreateCustomerId(): Promise<string> {
    const user = await getCurrentUser();

    const existing = await prisma.user.findUnique({
        where: { id: user.id },
        select: { stripeCustomerId: true },
    });

    if (existing?.stripeCustomerId) return existing.stripeCustomerId;

    const customer = await stripe().customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: user.id },
    });

    // Written before checkout is opened, so an abandoned checkout still leaves the account linked
    // to one customer rather than minting a new one on every attempt.
    await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customer.id },
    });

    return customer.id;
}

/**
 * Brings the local entitlement into line with Stripe, for one customer.
 *
 * **Reads the subscription back from the API rather than trusting the event payload.** Webhooks are
 * delivered at least once and in no guaranteed order: an `updated` event can arrive after the
 * `deleted` that superseded it, and a retry of a week-old event can arrive at any time. Deriving
 * state from "whatever Stripe says is true right now" makes both cases harmless, and makes the
 * whole handler idempotent by construction — no event log, no processed-id table.
 *
 * Called by the webhook for every subscription-shaped event, and safe to call from anywhere else.
 */
export async function syncSubscriptionState(customerId: string): Promise<void> {
    const subscriptions = await stripe().subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
    });

    // The most recent entitling subscription, if any. `list` returns newest first.
    const active = subscriptions.data.find((s) => ENTITLING_STATUSES.has(s.status));

    // `current_period_end` was removed from the Subscription resource in the 2025-03-31.basil API
    // version and lives on the subscription's *items* now. Reading it off the subscription — which
    // is what every pre-2025 example does — silently yields undefined.
    const periodEnd = active?.items.data[0]?.current_period_end;
    const priceId = active?.items.data[0]?.price.id ?? null;

    await prisma.user.updateMany({
        // `updateMany` rather than `update`: a webhook can name a customer this database has never
        // heard of — a customer created by hand in the dashboard, or one belonging to a deleted
        // account — and `update` throws P2025 on no match, which would answer Stripe with a 500 and
        // earn an endless retry of an event there is nothing to do about.
        where: { stripeCustomerId: customerId },
        data: {
            isPro: Boolean(active),
            stripeSubscriptionId: active?.id ?? null,
            stripePriceId: priceId,
            stripeCurrentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        },
    });
}

/** What the settings page's billing panel renders. */
export async function getBillingSummary(): Promise<BillingViewModel> {
    const user = await getCurrentUser();

    const row = await prisma.user.findUnique({
        where: { id: user.id },
        select: { stripeCustomerId: true, stripePriceId: true, stripeCurrentPeriodEnd: true },
    });

    return {
        isPro: user.isPro,
        cycle: cycleForPriceId(row?.stripePriceId),
        // Serialized at the server boundary, like every other date in `types/view-models.ts`.
        currentPeriodEnd: row?.stripeCurrentPeriodEnd?.toISOString() ?? null,
        hasCustomer: Boolean(row?.stripeCustomerId),
    };
}
```

---

### 3.5 `src/actions/billing.ts`

Server Actions, by `project-overview.md` §9's rule: *"a Server Action when the caller only needs
success or a message, a route handler when it needs to read an HTTP status."* Neither of these needs
a status — the success path is a `redirect()` the action performs itself, and the failure path is a
string for a toast.

```ts
"use server";

import { redirect } from "next/navigation";

import { priceIdFor } from "@/config/billing";
import { stripe, billingOrigin } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentUserId } from "@/server/current-user";
import { getOrCreateCustomerId } from "@/server/billing";
import type { BillingCycle } from "@/config/marketing";
import type { BillingActionResult } from "@/types/billing";

/**
 * Opens Stripe-hosted Checkout for the chosen cycle.
 *
 * The cycle is the *only* thing the payload is trusted with, and it is mapped to a Price id here
 * rather than accepted as one — the same rule `createItem` follows for item types. A payload
 * naming a price directly would let a caller check out against any price in the account,
 * including a $0 one they found in a URL somewhere.
 *
 * Redirects rather than returning a URL. `redirect()` throws, so anything after it is unreachable
 * and the caller needs no navigation code; the return type covers only the failure paths.
 */
export async function startCheckout(cycle: BillingCycle): Promise<BillingActionResult> {
    const userId = await getCurrentUserId();

    // A Checkout Session is a Stripe API call and a Customer row, on a route behind the session —
    // so this bounds cost rather than an anonymous flood, exactly like `upload`.
    const limit = await checkRateLimit("checkout", userId);

    if (!limit.success) {
        return { success: false, error: "Too many attempts. Try again in a few minutes." };
    }

    let url: string | null = null;

    try {
        const customerId = await getOrCreateCustomerId();

        const session = await stripe().checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            line_items: [{ price: priceIdFor(cycle), quantity: 1 }],
            // Belt and braces beside the customer id: the webhook finds the user by customer, but
            // metadata makes a session traceable from the dashboard without a database lookup.
            client_reference_id: userId,
            subscription_data: { metadata: { userId } },
            success_url: `${billingOrigin()}/settings?checkout=success`,
            cancel_url: `${billingOrigin()}/settings?checkout=cancelled`,
            allow_promotion_codes: true,
        });

        url = session.url;
    } catch (error) {
        console.error("Stripe checkout session failed:", error);

        return { success: false, error: "Could not start checkout. Try again." };
    }

    if (!url) return { success: false, error: "Could not start checkout. Try again." };

    // Outside the try: `redirect()` works by throwing, and a catch would swallow it and report a
    // failure for a session that was created successfully.
    redirect(url);
}

/**
 * Opens the Stripe-hosted Billing Portal: change card, switch plan, cancel, download invoices.
 *
 * All of that is Stripe's UI rather than ours by choice — every one of those flows has edge cases
 * (proration, dunning, tax) that are not this product's problem to solve.
 */
export async function openBillingPortal(): Promise<BillingActionResult> {
    await getCurrentUserId();

    let url: string | null = null;

    try {
        const customerId = await getOrCreateCustomerId();

        const session = await stripe().billingPortal.sessions.create({
            customer: customerId,
            return_url: `${billingOrigin()}/settings`,
        });

        url = session.url;
    } catch (error) {
        console.error("Stripe billing portal session failed:", error);

        return { success: false, error: "Could not open billing. Try again." };
    }

    redirect(url);
}
```

---

### 3.6 `src/app/api/stripe/webhook/route.ts`

A route handler because it is a webhook — named explicitly in `coding-standards.md`'s list of what
route handlers are for.

```ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { syncSubscriptionState } from "@/server/billing";

/**
 * Stripe's subscription lifecycle events.
 *
 * ⚠️ This path MUST be excluded from `src/proxy.ts`'s matcher. The proxy denies by default, Stripe
 * sends no session cookie, and a redirect to `/sign-in` reads to Stripe as a failed delivery — it
 * retries with backoff and eventually disables the endpoint, all without this handler ever running.
 *
 * Node runtime, not edge: the raw body has to survive byte-for-byte for the signature to verify,
 * and `request.text()` is what gives it. `force-dynamic` because a webhook is never cacheable.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The events acted on.
 *
 * `checkout.session.completed` is what grants Pro on the way back from checkout. The subscription
 * pair covers everything afterwards — plan switches, cancellations, and the transition to
 * `past_due` when a card fails. `invoice.payment_failed` is deliberately absent: it changes no
 * entitlement on its own (the subscription's *status* is what does), and handling it would only
 * duplicate what the status transition already reports.
 */
const HANDLED = new Set([
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
]);

export async function POST(request: Request) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
        console.error("STRIPE_WEBHOOK_SECRET is not set; refusing to process a webhook.");

        // 500 rather than 200: Stripe will retry, and an unconfigured deployment that silently
        // acknowledged events would drop every subscription change in the gap.
        return NextResponse.json({ error: "Not configured." }, { status: 500 });
    }

    // The RAW body. `request.json()` would re-serialize it, and a single reordered key or changed
    // whitespace invalidates the signature — which is the single most common way this handler is
    // got wrong.
    const body = await request.text();
    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
        return NextResponse.json({ error: "Missing signature." }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
        // The async variant: it uses SubtleCrypto rather than Node's synchronous crypto, so the
        // handler keeps working unchanged if this ever has to run somewhere without `node:crypto`.
        event = await stripe().webhooks.constructEventAsync(body, signature, secret);
    } catch (error) {
        // The signature is the only authentication this endpoint has — the URL is public and the
        // payload is attacker-controlled until this line passes. 400, and nothing is read.
        console.error("Stripe webhook signature verification failed:", error);

        return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }

    if (!HANDLED.has(event.type)) {
        // 200, not an error. An unhandled type is a subscribed event we have no work for, and
        // answering anything else earns a retry of something that will never be handled.
        return NextResponse.json({ received: true });
    }

    // Every handled event names a customer; which field it is on differs by type.
    const object = event.data.object as Stripe.Checkout.Session | Stripe.Subscription;
    const customerId = typeof object.customer === "string" ? object.customer : object.customer?.id;

    if (!customerId) {
        console.error(`Stripe webhook ${event.type} carried no customer id.`);

        return NextResponse.json({ received: true });
    }

    try {
        // One code path for all four events. `syncSubscriptionState` reads the truth back from
        // Stripe rather than applying the payload, so a retry, a duplicate, and an out-of-order
        // delivery all converge on the same row state — which is why there is no processed-event
        // table here.
        await syncSubscriptionState(customerId);
    } catch (error) {
        console.error(`Stripe webhook ${event.type} failed:`, error);

        // 500 so Stripe retries. A database blip must not silently cost someone the Pro they paid
        // for, and the sync being idempotent is what makes the retry safe.
        return NextResponse.json({ error: "Handler failed." }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
```

---

### 3.7 `src/types/billing.ts`

```ts
/**
 * What a billing Server Action hands back — the failure arm only. The success path is a
 * `redirect()` to Stripe, which throws, so there is no success value for a caller to read.
 *
 * Lives here rather than beside the actions for the reason `types/account.ts` states: a
 * `"use server"` module may only export async functions.
 */
export type BillingActionResult = { success: false; error: string };
```

And in `src/types/view-models.ts`:

```ts
import type { BillingCycle } from "@/config/marketing";

/** The settings page's billing panel, prepared at the server boundary. */
export interface BillingViewModel {
    isPro: boolean;
    /** `null` when free, or when the price does not match either configured Price id. */
    cycle: BillingCycle | null;
    /** ISO string, or `null` on a free account. */
    currentPeriodEnd: string | null;
    /** Whether a Stripe customer exists — the portal button needs one. */
    hasCustomer: boolean;
}
```

---

### 3.8 `src/components/settings/BillingPanelRows.tsx`

A client component, because the two buttons need pending state and a toast. It renders *inside* the
`Panel` the server page draws — the same split `EditorPreferencesRows` uses.

```tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { openBillingPortal, startCheckout } from "@/actions/billing";
import { PanelRow } from "@/components/ui/Panel";
import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/lib/format";
import type { BillingCycle } from "@/config/marketing";
import type { BillingViewModel } from "@/types/view-models";

/**
 * The billing panel's rows.
 *
 * Both actions redirect to Stripe on success, so neither returns anything on the happy path — a
 * result only ever arrives when something failed, which is why the handler below toasts on *any*
 * returned value rather than checking `success`.
 */
export function BillingPanelRows({ billing }: { billing: BillingViewModel }) {
    const [pending, start] = useTransition();

    const upgrade = (cycle: BillingCycle) =>
        start(async () => {
            const result = await startCheckout(cycle);
            if (result) toast.error(result.error);
        });

    const manage = () =>
        start(async () => {
            const result = await openBillingPortal();
            if (result) toast.error(result.error);
        });

    if (billing.isPro) {
        return (
            <PanelRow
                title={billing.cycle === "yearly" ? "Pro — annual" : "Pro — monthly"}
                description={
                    billing.currentPeriodEnd
                        ? `Renews on ${formatLongDate(billing.currentPeriodEnd)}.`
                        : "Change your plan, update your card, or cancel."
                }
            >
                <Button variant="outline" onClick={manage} disabled={pending}>
                    Manage subscription
                </Button>
            </PanelRow>
        );
    }

    return (
        <>
            <PanelRow
                title="Free plan"
                description="50 items, 3 collections, and the five text and link types. Upgrade for unlimited everything, file and image uploads, AI, and export."
            />
            <PanelRow
                title="Upgrade to Pro"
                description="$8 a month, or $72 a year — two months free. Cancel any time."
            >
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => upgrade("monthly")} disabled={pending}>
                        $8 / month
                    </Button>
                    <Button onClick={() => upgrade("yearly")} disabled={pending}>
                        $72 / year
                    </Button>
                </div>
            </PanelRow>
        </>
    );
}
```

---

## 4. Files to Modify

| # | File | Change | Why |
|---|---|---|---|
| 1 | `src/proxy.ts:61` | add `api/stripe/webhook` to the matcher's negative lookahead | **Blocking.** §2.1 — otherwise the webhook is never invoked at all. |
| 2 | `package.json` | `npm install stripe` | Not currently a dependency. |
| 3 | `prisma/schema.prisma` | `stripePriceId`, `stripeCurrentPeriodEnd` on `User` + migration | Optional; §3.1. |
| 4 | `src/lib/rate-limit.ts:41` | add `checkout: { tokens: 10, window: "10 m", keyBy: "user" }` to `LIMITS` | Follows the `upload` precedent — behind the session, bounding cost not anonymity. |
| 5 | `src/lib/limits.ts` | add `canCreateItem` / `canCreateCollection` | §5. |
| 6 | `src/actions/items.ts` (in `createItem`, after `getCurrentUserId` at ~:74) | count check before the write | §5. |
| 7 | `src/actions/collections.ts` (in `createCollection`, ~:50) | count check; replace the `:44-47` comment that says this is Phase 6 work | §5 — the comment names this exact change. |
| 8 | `src/app/(dashboard)/settings/page.tsx` | add a `<Panel id="billing">` above Account | The file's own comment at the top of `SettingsPage` says *"Billing and export are the next two, and each becomes another `Panel`"*. |
| 9 | `src/config/marketing.ts:145,169` | Pro CTA `href` → `/settings#billing`; drop the "No checkout exists yet (Phase 6)" comment | The Pro CTA currently sends everyone to `/register`. Signed-out visitors still need to register first — the marketing page is only served without a session, so `/register?plan=pro` and a post-registration redirect is the fuller version. |
| 10 | ~~`src/config/access.ts:5`~~ | ~~`ENFORCE_PRO_LIMITS = true`~~ — **not modified by this work** | Decided 2026-08-17: held until launch, then alone in its own commit. See §9. |
| 11 | `.env.example` | comment the Stripe block (webhook secret differs local vs deployed; publishable key unread) | The names are already there and uncommitted; every other block in the file is documented. |
| 12 | `src/types/view-models.ts` | `BillingViewModel`; `isPro` on `AccountSettingsViewModel` | §3.7, §6.6. |
| 13 | `src/actions/account.ts:105` (in `deleteAccount`) | refuse while a subscription would still bill; Stripe cleanup before `prisma.user.delete` | **Money.** §6 — otherwise a deleted account keeps being charged, with nothing left in the database to find it by. |
| 14 | `src/server/profile.ts:69` (`getAccountSettings`) | return `isPro` | §6.6. No new query — `getCurrentUser()` already selects it. |
| 15 | `src/components/settings/DeleteAccountDialog.tsx` | accept `isPro`; for a subscriber, replace the confirmation with a route to the portal | §6.6. |

### 4.1 Not modified, and worth saying why

- **`src/auth.ts`** — no change. The JWT carries no `isPro` and does not need to; see §6.
- **`src/server/current-user.ts`** — no change. It already selects `isPro` and is request-cached, so
  a webhook write is visible on the next request with no session work.
- **`src/app/api/upload/route.ts`** — no change. Already calls `canAccessItemType`; it starts
  enforcing the moment `ENFORCE_PRO_LIMITS` flips.

---

## 5. Feature Gating

### 5.1 The count limits

`project-overview.md` §7: free is **50 items** and **3 collections**. Add to `src/lib/limits.ts`
beside `canAccessItemType`, keeping the same short-circuit:

```ts
import { ENFORCE_PRO_LIMITS } from "@/config/access";

export const FREE_ITEM_LIMIT = 50;
export const FREE_COLLECTION_LIMIT = 3;

/**
 * Whether one more item may be created.
 *
 * Takes the current count rather than querying, so the rule stays a pure function — the same shape
 * `canAccessItemType` has, and the reason both are unit-testable without a database.
 */
export function canCreateItem(userIsPro: boolean, currentCount: number): boolean {
    return !ENFORCE_PRO_LIMITS || userIsPro || currentCount < FREE_ITEM_LIMIT;
}

export function canCreateCollection(userIsPro: boolean, currentCount: number): boolean {
    return !ENFORCE_PRO_LIMITS || userIsPro || currentCount < FREE_COLLECTION_LIMIT;
}
```

**Where they are checked.** Both writes are Server Actions and both already resolve the user first,
so the check costs one `count()`:

```ts
// src/actions/items.ts, in createItem — after the Zod parse, before the write
const { isPro } = await getCurrentUser();
const itemCount = await prisma.item.count({ where: { userId } });

if (!canCreateItem(isPro, itemCount)) {
    return {
        success: false,
        error: `Free accounts can hold ${FREE_ITEM_LIMIT} items. Upgrade to Pro for unlimited.`,
    };
}
```

`prisma.item.count({ where: { userId } })` is already the exact query `src/server/profile.ts` runs
twice, so the shape is established.

**Enforced at the write boundary only, deliberately.** The UI should *show* the cap (the profile
page already renders both totals) but the server action is the authority — the same division
`contentType` follows, per `project-overview.md` §5.

**A race exists and is acceptable.** Two concurrent creates can both read 49 and both write. Closing
it needs a transaction with a re-count, or a database constraint. For a 50-item soft cap on a
freemium tier, an occasional 51st item is not worth a transaction on the hottest write path — but it
should be a conscious decision, not an unnoticed one.

### 5.2 The UX at the cap — decided: hard block

`project-overview.md` §11 listed this as undecided — *"upgrade prompt vs hard block"*. **Decided
2026-08-17: hard block**, with an upgrade-flavoured error toast naming the cap and the way out.

The pricing page already promises "Up to 50 items", so a 51st that succeeds turns the number into
decoration and then 60, 200, and 2000 each need an answer too. The nag alternative also needs design
work — where the banner lives, when it stops — that has nothing to do with this integration.

### 5.3 Pro features and their current state

| Feature | Gate exists? | After `ENFORCE_PRO_LIMITS = true` |
|---|---|---|
| File / image types | ✅ `canAccessItemType` at 5 call sites | Types disappear from the sidebar, `/items/files` 404s, uploads 403 |
| 50 items | ❌ | Needs §5.1 |
| 3 collections | ❌ | Needs §5.1 |
| AI features | n/a — Phase 5, no code | Gate at the route when built |
| Export | n/a — Phase 4, no code | Gate at the route when built |
| Custom types | n/a — Phase 7 | — |

---

## 6. Cancelling and deleting are two different things

Today `deleteAccount()` (`src/actions/account.ts:105`) is one statement —
`prisma.user.delete({ where: { id: user.id } })` — and everything cascades from it. Once Stripe is
integrated, that becomes a defect that charges money: the row holding `stripeCustomerId` is gone,
the subscription in Stripe is untouched, and the card keeps being billed $8 a month for an account
that no longer exists. Nothing in the system can even find it afterwards — the only pointer was in
the row that was deleted.

That is the problem. This section is the decided answer to it.

### 6.1 The decision

**Two separate controls, and deletion is refused while a subscription would still bill.**

| Control | Where | What it does |
|---|---|---|
| **Manage subscription** | Billing panel (§3.8) | Opens the Stripe portal — cancel, switch plan, update card, invoices |
| **Delete account** | Account panel | Deletes the account. Refused while a subscription is live, with a route to the portal. |

Cancelling is not a side effect of deleting, and deleting is not how you cancel. This is what
GitHub, Linear, and Notion all do, and it has one property the auto-cancel alternative does not: the
app never destroys a paid subscription on the user's behalf. The person who bought it is the person
who ends it, in Stripe's own UI, where the cancellation is confirmed on screen and by email from
Stripe.

The cost is one extra trip for the rare user who deletes without cancelling first. That is the
trade, taken deliberately.

### 6.2 "Live" means *will bill again*, not *status is active*

This is the part that is easy to get wrong, and getting it wrong punishes exactly the users who did
what they were told.

**The Stripe customer portal cancels at period end by default.** A user who cancels on 20 March with
a billing date of the 5th leaves the subscription in status `active` with
`cancel_at_period_end: true` until 5 April. They have cancelled. No further charge will happen. But
a naive `status === "active"` check would refuse their account deletion for another sixteen days —
after they followed the instructions.

So the gate is:

```ts
/**
 * Whether this subscription still has a charge ahead of it.
 *
 * Deliberately not `ENTITLING_STATUSES.has(status)`. A subscription cancelled through the portal
 * stays `active` until the period it was already paid for runs out — the user has cancelled, no
 * further charge is coming, and blocking their account deletion for the rest of the month would be
 * refusing them for having done the thing we asked.
 *
 * `trialing` counts: a trial converts to a paid charge unless it is cancelled.
 */
function willBillAgain(subscription: Stripe.Subscription): boolean {
    return ENTITLING_STATUSES.has(subscription.status) && !subscription.cancel_at_period_end;
}
```

Read plainly: **block only if money is still going to move.**

### 6.3 The check reads Stripe, not our database

The obvious implementation asks the local row — `user.isPro`, or `stripeSubscriptionId != null` —
and it is wrong for the one case this whole section exists to prevent.

`isPro` is only as fresh as the last webhook that landed. If a delivery was missed, or the endpoint
was down for an hour, the row can say "not subscribed" while Stripe says "active, billing on the
5th". A gate built on the local row would wave that user straight through, and the subscription they
still have would keep charging with nothing left to find it by. The stale-state case is precisely
the case the gate is for.

So `deleteAccount` asks Stripe. One API call, on an action a user performs approximately once in
their life:

```ts
/**
 * Whether a live subscription stands in the way of deleting this account.
 *
 * Asks Stripe rather than reading `isPro` off the row, and that is the whole point of the function.
 * `isPro` is only as current as the last webhook that arrived; a missed delivery leaves the row
 * saying "free" for an account Stripe is still billing, and that is the exact case this gate exists
 * to catch. A gate that trusts local state is a gate that fails when state is wrong.
 *
 * The settings page still renders its billing panel from the local row — that is presentation, and
 * a Stripe round trip on every page view to draw a button is not worth it. Only the deletion asks
 * for the truth.
 */
export async function hasBillableSubscription(userId: string): Promise<boolean> {
    const row = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
    });

    // Never opened checkout: there is no customer, so there is nothing to bill. The common path,
    // and it costs no API call.
    if (!row?.stripeCustomerId) return false;

    const subscriptions = await stripe().subscriptions.list({
        customer: row.stripeCustomerId,
        status: "all",
        limit: 10,
    });

    return subscriptions.data.some(willBillAgain);
}
```

### 6.4 What `deleteAccount` becomes

```ts
// After the typed-email confirmation, before the delete.
//
// Refused rather than cancelled on the user's behalf: ending a paid subscription is their decision
// to make in Stripe's own UI, where they get a confirmation on screen and by email. The account is
// still here afterwards, so this is a redirect to the portal, not a dead end.
if (await hasBillableSubscription(user.id)) {
    return {
        error: "You still have an active Pro subscription. Cancel it first — the button is in Settings → Billing — and then you can delete your account.",
    };
}

try {
    // Best-effort cleanup, and not load-bearing: §6.3 has already established that nothing is going
    // to bill this customer, so a failure here costs no money. It removes the stored card and the
    // Customer record for someone who no longer has an account, which is worth doing and is not
    // worth blocking a deletion over — a Stripe outage must not stop someone leaving.
    //
    // Runs before the row delete because the cascade destroys the only copy of `stripeCustomerId`.
    await endBillingRelationship(user.id).catch((error) => {
        console.error("Stripe cleanup failed during account deletion:", error);
    });

    await prisma.user.delete({ where: { id: user.id } });
} catch (error) {
    console.error("Account deletion failed:", error);

    return { error: "Could not delete your account. Try again." };
}
```

`endBillingRelationship` is the `customers.del()` helper from §6.5. `signOut` stays outside the
`try`, for the reason the file already documents — it leaves by throwing `NEXT_REDIRECT`, which the
catch would otherwise swallow and report as a failure for a deletion that succeeded.

**The gate is what buys the simplicity here.** In the auto-cancel design, the Stripe call was the
only thing standing between a deleted account and a recurring charge, so its failure had to abort
the deletion — which in turn created a retry that could deadlock on an already-deleted customer.
With the gate in front, money is already off the table by the time this line runs, so the call can
be best-effort and the whole failure-ordering problem disappears. Choosing the more conventional
policy also produced the simpler code.

### 6.5 `src/server/billing.ts` — the cleanup helper

```ts
/**
 * Removes the Stripe customer for an account being deleted.
 *
 * `customers.del` rather than `subscriptions.cancel`: it removes the stored card, which a bare
 * cancellation leaves behind attached to someone who no longer has an account, and it catches any
 * subscription on the customer rather than only the one the local row was tracking.
 *
 * Callers treat a failure as non-fatal — see `deleteAccount`. `hasBillableSubscription` has already
 * confirmed nothing is going to charge, so this is hygiene rather than the thing preventing a bill.
 *
 * An already-deleted customer is the outcome this function exists to produce, so `resource_missing`
 * is success rather than an error.
 */
export async function endBillingRelationship(userId: string): Promise<void> {
    const row = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
    });

    if (!row?.stripeCustomerId) return;

    try {
        await stripe().customers.del(row.stripeCustomerId);
    } catch (error) {
        if ((error as Stripe.errors.StripeError)?.code === "resource_missing") return;

        throw error;
    }
}
```

**Not redaction.** Stripe recommends [redaction jobs](https://docs.stripe.com/privacy/redaction) for
*consumer data deletion requests*, which is a different event from account closure: redaction is
asynchronous, and it scrubs personal data out of invoices, events, and request logs — including
records that may need to stay readable for tax. `customers.del()` on self-service deletion, and a
redaction job only when someone makes an explicit GDPR/CCPA erasure request. Worth writing down as
the escalation path rather than discovering it under a deadline.

### 6.6 What the user sees

The refusal has to be a route, not a wall. A dialog that says "you can't do this" and stops is the
dark pattern this design is otherwise avoiding.

- `AccountSettingsViewModel` gains `isPro`. **No new query** — `getAccountSettings()`
  (`src/server/profile.ts:69`) already resolves through `getCurrentUser()`, which selects it.
- `DeleteAccountDialog` takes `isPro`. When true, the dialog does not offer the typed-email
  confirmation at all: it explains that the subscription has to be cancelled first, and renders a
  **Cancel subscription** button that opens the Stripe portal — the same `openBillingPortal` action
  the billing panel uses.
- The server-side refusal in §6.4 stays regardless. The dialog is the convenience; the action is the
  control. That is the same division the typed-email confirmation already documents.
- The local `isPro` is enough to *draw* this, because being wrong is cheap in both directions: a
  stale `true` shows a portal that says "no subscription", and a stale `false` lets them through to
  the server check that actually decides.

### 6.7 Two things this deliberately accepts

- **The user who cancels and immediately deletes leaves a scheduled subscription behind** if the
  `customers.del()` cleanup fails. No money moves — it was already cancelled — and it ages out on
  its own at period end.
- **No refund of the unused period**, which is the market norm and now entirely Stripe's portal to
  communicate, since the portal is where the cancellation happens.

---

## 7. The JWT / session question

The research prompt proposes syncing `isPro` from the database inside the JWT callback on every
session validation. **The concern is worth stating in one paragraph before the code:** this app does
not read `isPro` from the session at all. Every gate goes through `getCurrentUser()`
(`src/server/current-user.ts:34`), which reads `isPro` from Postgres on each request and is
React-`cache`d, so a webhook write is already authoritative on the very next request — no session
refresh, no page reload, no token work. Adding the read to the JWT callback would add a *second*
Postgres query per request on top of the one `getCurrentUser` already makes, to feed a token field
nothing currently reads.

**So the recommendation is: don't add it, unless and until a client component needs `isPro` from
`useSession()`.** Nothing in `src/components/` does today — `SidebarNav`'s `<ProBadge />` is fed by
a server-rendered view model, and the billing panel above is fed by `getBillingSummary()`.

**If you do want it** — a client-side upgrade banner is the plausible reason — here is the version
adapted to this codebase. Note it is `token.id`, not `token.sub`: `src/auth.ts:143` writes `id`, and
copying the prompt's snippet verbatim would read an undefined field.

```ts
// src/auth.ts — replacing the jwt callback at :141
async jwt({ token, user }) {
    if (user?.id) {
        token.id = user.id;
    }

    // Re-read on every validation rather than only on `trigger === "update"`. A Stripe webhook
    // writes `isPro` in a request the browser never made, so there is no `update()` call to hang
    // the refresh on — a token minted before checkout would keep saying `false` until it expired.
    // The cost is one indexed primary-key lookup per session validation.
    if (token.id) {
        const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
            select: { isPro: true },
        });
        token.isPro = dbUser?.isPro ?? false;
    }

    return token;
},

async session({ session, token }) {
    if (token.id) {
        session.user.id = token.id;
    }
    session.user.isPro = token.isPro ?? false;
    return session;
},
```

Both augmentations in `src/types/next-auth.d.ts` need extending — `Session["user"]` and the
`@auth/core/jwt` `JWT` interface — following the pattern already there for `id`.

**One thing this must not do:** the callback lives in `src/auth.ts`, never `src/auth.config.ts`.
`src/proxy.ts` builds its NextAuth instance from the edge-safe config, and pulling a Prisma read
into that module graph breaks the build — which is the entire reason the config is split
(`src/auth.config.ts`'s header comment).

**The simplest correct answer either way:** `success_url` points at `/settings?checkout=success`,
which is a fresh server-rendered request, so `getCurrentUser()` reads the new `isPro` directly. The
one genuine race is checkout completing *before* the webhook lands — Stripe usually delivers within
a second or two, but not always. Handle it in the UI, not the session: on `?checkout=success`, show
"Your upgrade is being confirmed…" and `router.refresh()` once after a short delay.

---

## 8. Stripe Dashboard Setup

1. **Create the product.** Product catalog → Add product → *DevStash Pro*.
2. **Add two recurring prices** on that one product — not two products:
   - $8.00 USD / monthly recurring → copy the price id into `STRIPE_PRICE_ID_MONTHLY`
   - $72.00 USD / yearly recurring → `STRIPE_PRICE_ID_YEARLY`

   One product with two prices is what lets the Billing Portal offer a monthly↔yearly switch.
3. **API keys** (Developers → API keys, in **test mode** first): secret key → `STRIPE_SECRET_KEY`.
4. **Configure the Billing Portal** (Settings → Billing → Customer portal). Without this,
   `billingPortal.sessions.create` fails outright with a configuration error. Turn on:
   cancel subscription, update payment method, switch plan (list both prices), invoice history.
5. **Webhook endpoint** (Developers → Webhooks → Add endpoint):
   - URL `https://<your-domain>/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the signing secret → `STRIPE_WEBHOOK_SECRET`
6. **Local development** uses a *different* secret. `stripe listen` prints its own `whsec_…`, which
   is not the dashboard endpoint's — this is a routine hour-long confusion:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
7. **Repeat 1–5 in live mode** before launch. Price ids, keys, and webhook secrets are all
   mode-specific; none of the test values work in production.

---

## 9. Implementation Order

Each step leaves the app working.

| # | Step | Verify by |
|---|---|---|
| 1 | `npm install stripe`; document the `.env.example` block | `npm run build` |
| 2 | Migration for `stripePriceId` / `stripeCurrentPeriodEnd` (if taking §3.1) | `npm run db:status` |
| 3 | `src/lib/stripe.ts`, `src/config/billing.ts` + unit test for `cycleForPriceId` | `npm test` |
| 4 | **`src/proxy.ts` matcher** — do this before the webhook, not after | — |
| 5 | `src/server/billing.ts`, `src/app/api/stripe/webhook/route.ts` | `stripe trigger customer.subscription.deleted`; check for a 200 and no `isPro` change on an unknown customer |
| 6 | `src/actions/billing.ts` + `checkout` rate limit | — |
| 7 | Settings billing panel + `src/types/billing.ts` | full checkout round trip against test cards |
| 8 | **Account deletion is gated on billing** (§6) — `hasBillableSubscription`, `endBillingRelationship`, the `deleteAccount` refusal, and the dialog's portal route | §10.3 |
| 9 | Marketing CTA wiring | — |
| 10 | `canCreateItem` / `canCreateCollection` + their unit tests | `npm test` |
| — | ~~`ENFORCE_PRO_LIMITS = true`~~ — **not part of this work.** Decided 2026-08-17: the switch flips at launch, alone, in its own commit | manual pass as a free account, on that day |

Step 8 goes in **the same release as step 7**, not later. Step 7 is what first lets a real card be
charged; every day between that and step 8 is a day a deletion can strand a live subscription with
no way to find it again.

The flag is held back for the same reason it would have gone last: it changes behaviour on five
existing call sites this work never touches, so it should be the one thing in its commit and
trivially revertable. Holding it until launch costs nothing — every step above is complete and
testable with it off, since the flag only decides whether the gates *refuse* anyone — and flipping
it early costs something immediately, because the development account loses the file and image types
the same moment unless `isPro` is set on that row by hand.

---

## 10. Testing Checklist

### 10.1 Unit (`npm test` — vitest, tests beside the module)

- [ ] `src/config/billing.test.ts` — `cycleForPriceId` returns `"monthly"` / `"yearly"` / `null`,
      and `null` for an unset env var rather than throwing.
- [ ] `src/lib/limits.test.ts` (extend the existing file) — `canCreateItem` /
      `canCreateCollection`: at the boundary (49/50/51, 2/3/4), Pro always true, and
      `ENFORCE_PRO_LIMITS = false` always true.
- [ ] `ENTITLING_STATUSES` — `active`, `trialing`, **and `past_due`** in; `canceled` / `unpaid` /
      `incomplete` out. Assert `past_due` explicitly rather than leaving it to the "not in the set"
      case: it is the one member that reads as a bug to a future reader, so the test is where the
      grace-period decision lives in code.

### 10.2 Webhook (`stripe listen` running)

- [ ] Valid signature → 200; `isPro` true in the database.
- [ ] Tampered body → **400**, database untouched.
- [ ] Missing `stripe-signature` header → 400.
- [ ] **Replay the same event twice** → same final state, no error. This is the idempotency claim.
- [ ] Event for a customer id not in the database → 200, no throw (the `updateMany` in §3.4).
- [ ] `stripe trigger customer.subscription.deleted` → `isPro` false,
      `stripeSubscriptionId` null.
- [ ] **With the app running but the proxy fix reverted** → confirm the 3xx. Worth seeing once, so
      the failure mode is recognisable if it ever recurs.

### 10.3 Account deletion (§6)

- [ ] Free account (no `stripeCustomerId`) → deletes exactly as it does today, no Stripe call made.
- [ ] Active subscription → delete is **refused**, and the dialog offers the portal instead of the
      typed-email confirmation.
- [ ] **The one that matters (§6.2):** cancel in the portal, then immediately attempt deletion —
      the subscription is still `active` with `cancel_at_period_end: true`, and deletion must
      **succeed**. A `status === "active"` check would wrongly block here; this is the regression
      test for that mistake.
- [ ] Stale local state: set `isPro = false` by hand on a row whose Stripe subscription is live,
      then delete → still refused, because §6.3 asks Stripe rather than the row.
- [ ] Period actually elapses (Stripe **test clock**, not a month of waiting) → subscription
      `canceled`, deletion succeeds, no further invoice.
- [ ] Stripe unreachable (bad `STRIPE_SECRET_KEY`) on a free account → deletion still works. On a
      subscriber, the refusal errs on the side of refusing.
- [ ] Cleanup failure is non-fatal: delete the customer by hand in the dashboard, then delete the
      account → succeeds, `resource_missing` swallowed.
- [ ] `customer.subscription.deleted` arrives after the row is gone → webhook answers 200, no throw.

### 10.4 End-to-end

This is exactly the *multi-step end-to-end territory* `context/ai-interaction.md` names as the
narrow case where driving the browser is warranted — a sequence where the failure is invisible to
unit tests and tedious to reproduce by hand.

- [ ] Free account → Settings → `$8 / month` → Stripe Checkout → card `4242 4242 4242 4242` →
      back on `/settings` → panel says Pro.
- [ ] Sidebar now shows Files and Images; `/items/files` loads; an upload succeeds.
- [ ] `$72 / year` produces the annual price on the Stripe page.
- [ ] Cancel checkout → `?checkout=cancelled`, still free, no orphaned state.
- [ ] Billing Portal → cancel → return → Pro revoked (may need one refresh for the webhook).
- [ ] Portal → switch monthly → yearly → panel's cycle and renewal date both update.
- [ ] Declining card `4000 0000 0000 0341` → subscription lands `past_due` → **still Pro**. This is
      the grace period from §3.2, and this is the assertion that proves it.
- [ ] Drive that subscription on to `canceled` with a Stripe **test clock** rather than waiting out
      three weeks of real retries → Pro revoked. The grace period has to end somewhere; this is the
      only check that shows it does.
- [ ] Flip `ENFORCE_PRO_LIMITS` **locally and temporarily** to exercise the count checks: a free
      account at 50 items gets the block, and the same account after upgrading does not. Revert
      before committing — the flag ships `false`.

### 10.5 Security

- [ ] `startCheckout` with a hand-made call passing a price id instead of a cycle → rejected by the
      type, and by `priceIdFor` at runtime.
- [ ] Two accounts: A's `stripeCustomerId` cannot be reached from B's portal action.
- [ ] `grep -r "STRIPE_SECRET" .next/static` after a build → no hits. (`import "server-only"` should
      make this impossible, but it is a two-second check on a secret worth money.)
- [ ] The webhook route is the *only* thing excluded from the proxy — `/api/stripe/checkout` should
      not exist as a route at all under this plan, but confirm nothing else slipped into the
      lookahead.

---

## 11. Open Questions

1. ~~**`past_due` and Pro.**~~ **Decided 2026-08-17 — see §3.2.** `past_due` entitles: a failed
   payment keeps Pro for the length of Stripe's retry window, and access ends when Stripe gives up
   and the subscription goes `canceled`. What remains open is only the dunning email copy, which is
   a separate piece of work and does not change the set.
2. **Cancel-at-period-end.** Stripe keeps the subscription `active` until the period ends, so this
   plan keeps Pro until then — correct, but the settings panel says "Renews on…" when it should say
   "Ends on…". Reading `subscription.cancel_at_period_end` into the view model fixes it.
3. **The 50-item race** (§5.1). Accepted here; flag if it ever matters.
4. ~~Account deletion does not cancel the subscription.~~ **Decided — see §6.** Cancelling and
   deleting are separate controls; deletion is refused while a subscription would still bill, and
   the refusal routes to the Stripe portal. What remains open is only the adjacent question
   `project-overview.md` §11 already carries: soft vs hard delete.
5. **`STRIPE_PUBLISHABLE_KEY`** (§2.3) — drop it or document it as unread.
6. **The R2 orphan, now that the same path is being opened.** §6 fixes the money half of
   `deleteAccount`'s "read what you need before the cascade destroys it" problem; the file half —
   `project-overview.md` §11's unbounded R2 orphans — is the identical shape and is *not* fixed
   here. Worth folding into the same commit if the appetite is there, since it is the same three
   lines in the same function and the reasoning is already written down.
7. **Free-tier enforcement on *existing* accounts.** Flipping `ENFORCE_PRO_LIMITS` on a database
   where a test account already holds 200 items blocks new creates but does not delete anything.
   That is the right behaviour; confirm it is the intended one before launch.
