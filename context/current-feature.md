# Current Feature

## Status

Not Started — nothing queued.

## Goals

Nothing queued. **The domain is the blocker for real users** and is not a coding task until one
exists — see the Notes below and §10 Phase 7.

Since the 2026-09-01 batch closed, four more went with it: the R2 sweep on account deletion (#111),
tag scoping with case folding (#112), the shorter session lifetime (#113), and collection activity
recency (#114). What is left is in `project-overview.md` §10 and §11; the decisions still genuinely
open, none of them blocking, are:

- **Account linking + OAuth email normalization** (§11) — GitHub emails are not normalized,
  credentials emails are, so one person can be two rows. Must be settled *with* linking, since the
  two answers have to agree.
- **Session revocation** (§11) — the real fix, now that #113 has bounded the idle window. Reopens
  the JWT-vs-database session decision rather than patching it.
- **Soft vs hard delete** (§11), **export scope** (§11 + §10 Phase 4), **search depth free vs Pro**
  (§11 + §10 Phase 3), **AI usage accounting** (§11).

And three features that #112 unblocked and that nothing else depends on: **tag autocomplete**
(which should also feed the AI tagger, since `lib/ai-tags.ts` never shows the model the account's
existing vocabulary), then **tag filtering**, then **merge/rename**.

## Notes

**Things Tom needs to do, not Claude:**

- **Set `CRON_SECRET` in Vercel** (Settings → Environment Variables → Production), then redeploy.
  Generate with `openssl rand -base64 32`. Until then the nightly sweep answers 503 and does
  nothing — deliberately, since a deletion endpoint with no password is worse than one that does not
  run. `vercel.json` schedules it for 03:17 daily.
- **Confirm `AUTH_URL` is set in Vercel.** It is in the local `.env` but is *not* listed in
  `.env.production.example`, so the record does not say whether production has it. It builds the
  links in confirmation emails and Stripe's return URLs, and it is what the signed-out `/` rewrite
  reads — see `src/proxy.ts`.

**Everything else still open lives in `context/project-overview.md`** — §10 for the roadmap and §11
for the open questions, both brought back in line with the code on 2026-09-01. The short version of
what is there, so this file does not become a third place to drift:

- **The domain.** The one real defect left: with `EMAIL_FROM` unset, Resend delivers only to the
  account owner's own address, so every other registration completes and then reports that its
  confirmation email could not be sent. Nobody else can sign in. Everything email-shaped waits for a
  verified domain and is fixed together at that point. `metadataBase`, an OG image, `robots.txt` and
  `sitemap.ts` all need the real origin too, and belong in the same batch.
- **Session revocation** (§11) — deliberately deferred; it reopens the JWT-vs-database session
  decision rather than being a patch.
- **Collection reads transfer one row per item** (§11) — deferred by decision on 2026-09-01; the
  aggregate that fixes it cannot be expressed through Prisma's typed API and needs the first
  `$queryRaw` in `src/`.
- **Light mode** (§10 Phase 1) — the last item of that phase; no theme provider exists yet.
- **"Recently used"** (§10 Phase 2) — really the collection-`updatedAt` question in §11.
- **Import from a file, export JSON/ZIP** (§10 Phase 4), **full-content search** (§10 Phase 3),
  **custom item types** (§10 Phase 7).
- **OAuth email normalization**, **soft delete**, **AI usage accounting**, **caching** (§11).

**Two small things flagged in conversation and recorded nowhere else:**

- `docs/stripe-integration-plan.md` cites `context/research/stripe-integration-research.md`, which
  does not exist — that directory holds only the ai, item-crud and item-types research files. Left
  alone deliberately: it is inside the plan's own header, and correcting it would edit the record.
- Markdown line anchors (`file.ts#L42`) rot silently and nothing checks them. Five of six in
  `docs/item-types.md` had drifted before 2026-09-01. The next docs pass will find more.

## History

Completed features are logged in `context/feature-history.md`.
