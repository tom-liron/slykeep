# Current Feature

## Status

Not Started — nothing queued. Both features chosen on 2026-09-01 as "must happen before any real
user touches the app" have shipped (`feature-history.md` #111, #112).

## Goals

Nothing queued. The next item worth taking is **the domain**, which is the only thing still blocking
real users — see the Notes below and §10 Phase 7. It is not a coding task until a domain exists.

Two features fall out of the tag scoping just completed, neither on the roadmap yet, both now
cheap in a way they were not before:

- **Tag autocomplete.** A `getUserTags(userId)` query in `src/server/`, names with usage counts, and
  the tag input becomes a combobox suggesting from the account's own vocabulary. This is the real
  defence against `react` / `reactjs` / `react-js` drift, which case folding deliberately does not
  touch. It should also feed the AI tagger: `lib/ai-tags.ts` never tells the model which tags the
  account already uses, so auto-tagging currently *generates* drift rather than resisting it.
- **Tag filtering.** The badges on `ItemCard` are inert text. Clicking one should reach
  `/items?tag=react`, plus probably a tag index page with counts. Worth doing *after* autocomplete —
  filtering a drifted vocabulary reads as a broken feature even when the filter is correct.

A **merge/rename** control is the third piece and the cleanup half of the same story: now that tags
have an owner, merging `reactjs` into `react` is repointing join rows and deleting the loser.

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
