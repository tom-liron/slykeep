# Rebrand: DevStash → SlyKeep, with Privacy and Terms

Written 2026-09-10. One feature branch, `feature/slykeep-rebrand`.

## Why this is urgent, not cosmetic

`slykeep.com` is flagged by Google Safe Browsing as **"Deceptive pages" (social engineering)**.
Chrome shows a red interstitial on every visit, including the GitHub OAuth callback, so the site is
effectively unreachable. Search Console is verified but lists **no sample URLs**, so the trigger is
unconfirmed.

The strongest hypothesis is a **brand mismatch**: a days-old domain called `slykeep.com` serves a
credential login form headed "Sign in to **DevStash**", with a `<title>` of "DevStash", and has no
crawlable content beyond a landing page and auth screens. That shape — new domain, name that does
not match the page, password form, nothing else to see — is what the classifier is trained on.

So the fix is to remove the mismatch and add the pages a real service has. It must ship **before**
Request Review is clicked: a review against an unchanged site gets upheld, and the next one is
slower.

## Goals

1. One name everywhere a user or a crawler can see it: **SlyKeep**.
2. Real `/privacy` and `/terms` pages, publicly reachable, describing what the app actually does
   with data.
3. No regressions in the app, and no churn in names nobody sees.

## Scope

### 1. The rename

31 occurrences across 22 files in `src/`, plus `prisma/schema.prisma` and `README.md`.
`src/generated/` is excluded — it is generated Prisma output and is regenerated, not edited.

**Public surface — the part that actually matters for the flag:**

| File | Change |
|---|---|
| `src/app/layout.tsx` | `metadata.title` → `SlyKeep`; description reworded off "developer knowledge" boilerplate |
| `src/components/layout/Brand.tsx` | Wordmark → `SlyKeep`, and its docblock |
| `src/app/(marketing)/welcome/page.tsx` | Page title |
| `src/components/marketing/Hero.tsx` | Two body strings |
| `src/components/marketing/AiSection.tsx` | One body string |
| `src/components/marketing/MarketingFooter.tsx` | Copyright line |
| `src/app/(auth)/sign-in/page.tsx` | `<h1>` "Sign in to SlyKeep" + title + the comment quoting it |
| `src/app/(auth)/register`, `forgot-password`, `reset-password` | Titles |
| `src/app/(dashboard)/settings`, `profile`, `upgrade` | Titles and three body strings |
| `src/app/not-found.tsx`, `src/app/global-error.tsx` | Title and the "couldn't load" heading |
| `src/components/auth/ForgotPasswordForm.tsx` | "…SlyKeep account…" |
| `src/components/settings/ChangePasswordDialog.tsx` | Description |
| `src/lib/auth-errors.ts` (+ its test) | Two account-linking messages |
| `src/actions/account.ts` | GitHub-account error message |
| `src/server/infra/stripe.ts` | `appInfo.name` — shows in Stripe's dashboard, worth correcting |
| `prisma/schema.prisma`, `README.md` | Header comment, heading, body |

**Judgment calls — not a blind `sed`.** Four hits are identifiers or keys, not prose:

- `src/config/editor.ts` / `src/types/editor.ts` — the editor theme id `devstash-dark` and its label
  `"DevStash Dark"`. **Rename both.** The label is user-visible in the settings dropdown. The id is
  persisted in `User.editorPreferences`, but `lib/editor-preferences.ts` validates and falls back
  **per field**, so a stored `devstash-dark` resolves to `DEFAULT_EDITOR_PREFERENCES.theme` — which
  is this same theme under its new id. Anyone who chose it gets it back; anyone who chose another
  theme is untouched. No migration, no backfill.
- `src/server/infra/rate-limit.ts` — Redis key prefix `devstash:ratelimit:`. **Rename.** It orphans
  the current in-flight counters in Upstash, which means every limiter starts from zero once. On a
  project with this traffic that is not a consequence worth avoiding, and a stale prefix would
  linger for the life of the app.
- `src/components/layout/VerificationBanner.tsx` — the dismissal key
  `devstash:verification-banner-dismissed`. **Rename.** The store is `sessionStorage`, and the
  banner is designed to return on the next visit anyway, so the whole cost is one re-show in a tab
  that is open right now.
- `src/server/**/*.test.ts` — `devstash.test` email domains, bucket name `devstash-test`, Stripe
  metadata. **Rename the fixtures for consistency**; they are inert strings inside tests. The
  integration tests build their own throwaway resources, so nothing external is pinned to them.
- `prisma/seed-data.ts` — the demo account address `demo@devstash.io`. **Rename.** `prisma/seed.ts`
  upserts on this email, so the next `db:seed` against the development branch creates
  `demo@slykeep.com` beside the existing demo row rather than renaming it. Dropping the old row is a
  one-line delete whenever it is noticed; nothing in the application reads the address.

**Explicitly out of scope**, per the standing decision: the `(dashboard)` route group,
`DashboardLayout`, and `components/dashboard/`. Internal names, invisible to users, pure churn.

### 2. `/privacy` and `/terms`

**The routing trap, and the single most important line in this spec.** `src/proxy.ts` is
deny-by-default: its matcher covers everything not explicitly excluded, and a request with no
session that is not in `SIGNED_OUT_ROUTES` or `OPEN_ROUTES` is redirected to `/sign-in`. Googlebot
has no session. **Adding the pages without adding them to `OPEN_ROUTES` ships two routes that
redirect the crawler to a login form** — which is a worse version of the exact problem being fixed.

- Add `/privacy` and `/terms` to `OPEN_ROUTES` in `src/lib/auth-redirects.ts`, and extend that
  export's docblock: the set's current reasoning is entirely about links arriving from an inbox, and
  these two are there for a different reason — they must be readable by anyone, signed in or out,
  including a crawler. `resolveCallbackUrl` refuses `OPEN_ROUTES` as post-sign-in destinations,
  which is correct for these.
- Place both under the `(marketing)` route group, so they inherit `MarketingNav` and
  `MarketingFooter` and read as part of the site rather than as loose documents. Each gets its own
  `metadata`.
- Wire the footer. `PLACEHOLDER_COLUMNS` rendered muted `<span>`s for Docs, Changelog, Support,
  About, Privacy and Terms. The Resources column is deleted outright — those three pages will never
  be built, and a footer advertising documentation and support that do not exist reads as a mockup,
  which is the opposite of what this pass is for. What remains is `COMPANY_LINKS`: About, Privacy,
  Terms, every one a real route, rendered through `next/link`. The placeholder `<span>` branch goes
  with them.
- An `/about` page was built and then dropped: the Terms open by saying what SlyKeep is, and a third
  page repeating it in a different voice earned less than it cost. The shell it prompted stays as
  `ProsePage`/`ProseSection` — a narrow prose column with nothing legal about it, which is what the
  two remaining pages actually need.

**Content.** Drafted from what the code actually does, not from a template:

- **Account data** — email, optional name, bcrypt password hash or a GitHub OAuth account link,
  `emailVerified`, sessions.
- **Content** — items, collections, tags, custom item types, editor preferences, stored in Postgres
  (Neon).
- **Files** — uploads in Cloudflare R2 under a per-user prefix; the bucket is private and nothing
  builds a public URL.
- **Payments** — Stripe. Card details never reach this app; it stores a customer id, a subscription
  id, a price id, and a period end.
- **AI** — item title and content are sent to OpenAI (`gpt-5-nano`) only when the user invokes one
  of the four AI actions. Not a background process, not on save.
- **Email** — Resend, for verification, password reset and account notices only. No marketing mail.
- **Rate limiting** — Upstash Redis holds request counters keyed by user or IP.
- **Deletion** — `deleteAccount` cancels the Stripe subscription, deletes the user row (cascading to
  all content), and sweeps the R2 prefix. Unverified accounts are swept nightly.
- No analytics, no ad networks, no tracking cookies, no selling of data — all true of the code as
  written, and all worth stating plainly on a page whose job is to establish legitimacy.

**Settled inputs** (from the user, 2026-09-10):

- **Operator:** named as the project — "an independent portfolio project, not a registered company" —
  with **no personal name anywhere on either page**, and the operator/contact block at the bottom
  rather than in the lead. Identifying an operator is standard and GDPR Art. 13 asks for the
  controller's identity, but a project name plus a reachable address is what the overwhelming
  majority of independent projects publish, and the residual risk for a non-commercial project is
  small. It costs a sliver of legitimacy signal, which the honesty about demo status more than
  repays.
- **Contact:** `privacy@slykeep.com`. Namecheap email forwarding is already live on the domain
  (`MX → eforward*.registrar-servers.com`), so this is a forwarding alias to add in the Namecheap
  dashboard — no mailbox, no cost, and no personal address published. **Adding the alias is a
  pre-deploy step**, listed in the checklist below.
- **Governing law:** **omitted deliberately.** Nothing requires a Terms page to carry one; without
  it, default conflict-of-laws rules apply, which for a consumer service already points at the
  user's own jurisdiction. Naming a jurisdiction with no real connection would be unenforceable and
  dishonest on a page whose whole purpose is signalling honesty, and a `[JURISDICTION]` placeholder
  reads as an unfinished template to exactly the reviewer being appealed to. If SlyKeep ever stops
  being a portfolio project, it slots in as one clause at the end of the Terms.

### 4. Billing honesty — added mid-implementation

`STRIPE_SECRET_KEY` is an `sk_test_` key, so checkout cannot take a real card. Meanwhile `/welcome`
renders a pricing table quoting $8/month and $72/year behind a "Go Pro" button, and `/upgrade` did
the same while also advertising an **export** feature that does not exist anywhere in the codebase.

The disclosure this needs is narrower than it first appears. A signed-out visitor reaches no payment
form: the Pro call to action points at `/settings#billing`, behind authentication, and Stripe hosts
the card fields on its own domain. What `/welcome` shows is a price table, which is not deceptive on
its own. So the landing page keeps its pricing unqualified, and the disclosure sits where someone is
actually about to transact.

- `DemoBillingNotice` in `components/billing/`, on `/upgrade` beneath the plan cards.
- The `/upgrade` header drops the export claim — no export feature exists anywhere in the codebase,
  and it was never in `PRICING_PLANS` either.
- The Terms billing section states it in prose, for anyone reading before they sign up, in place of
  the renewals and cancellations an earlier draft described that cannot happen.

Both places assert the same fact. Configuring live Stripe keys means changing both.

**These pages are a draft for the user to read and approve before deploy.** They describe observed
behaviour of this codebase. They do not assert compliance with any regime on the user's behalf —
no "we are GDPR compliant", no certifications, no claims that cannot be verified from the code.
Each page carries a `Last updated` date.

### 3. Copy constraint

"stash" as a **noun** is banned in new UI copy ("your stash", "in the stash"); the verb is fine
("start stashing", "everything you stash"). Two pre-existing noun violations were deliberately left
for this pass and are fixed here:

- `src/app/(dashboard)/profile/page.tsx:50` — Usage panel: "What is in your stash right now."
- `src/components/marketing/PricingPlans.tsx:33` — "…when your stash becomes the thing you work out
  of."

Verb uses in `CtaSection.tsx`, `FeatureGrid.tsx` and `MarketingFooter.tsx` are correct English and
stay.

## Constraints

- **Do not push to `origin/devstash`.** It is a deliberate pre-rebrand snapshot parked at `82b1625`;
  pushing fast-forwards it to `main` and destroys what it is for.
- `EMAIL_FROM` and `AUTH_URL` are already on slykeep.com. Do not touch them.
- Pricing copy: if any number moves, `config/marketing.ts` and `project-overview.md` §7 must stay in
  step. **Nothing in this pass changes a price** — only the sentence containing "your stash".
- `src/generated/` is untouched.

## Verification

- `npm test` — `auth-errors.test.ts` asserts the DevStash string and must be updated with it.
- `npm run lint`, `npm run build`.
- `npm run docs:links` — docblocks are edited in `Brand.tsx`, `auth-redirects.ts`, `editor.ts` and
  `MarketingFooter.tsx`.
- `grep -rn "DevStash\|devstash" src/ --exclude-dir=generated` should return only the deliberate
  `localStorage` key and its explaining comment.
- Browser: not warranted. The change is strings and two static pages; a passing build means the
  markup is there.

## After it ships — outside the repo, by the user, in this order

1. **Add the `privacy@slykeep.com` forwarding alias** in Namecheap. The Privacy page publishes it;
   it must reach an inbox before the review, since an unreachable contact is worse than none.
2. Deploy. Confirm **in incognito** that the `<title>`, the wordmark, `/privacy` and `/terms` are all
   live and that the two pages load **without** redirecting to `/sign-in`.
3. GitHub OAuth app — already renamed to SlyKeep, callback URL included. Nothing to do.
4. **Then** Search Console → Security issues → Request Review. Describe it as a personal developer
   knowledge-hub app that was mid-rename, with the domain and the site branding now consistent, and
   Privacy and Terms published.

Step 4 comes last on purpose. A review filed before the deploy is a review against the site that was
flagged.
