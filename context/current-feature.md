# Current Feature

## Status

Blocked — one decision needed from Tom before feature 2 (tag scoping) can start. Feature 1 (R2
cleanup on account deletion) shipped; see `feature-history.md` #111.

## Goals

### Tag scoping — needs one decision from Tom before any code

`Tag.name` is `@unique` globally (`prisma/schema.prisma`), so tags are shared rows across every
account: two users who both write `react` get one row, and autocomplete is polluted across accounts.
The target is `@@unique([userId, name])`.

**The migration is a data migration, not just DDL, and that is the part to think about.** Tags reach
items through the implicit `_ItemTags` join, so an existing shared tag row may be referenced by two
different users' items. Scoping it means splitting one row into one row *per user who uses it* and
repointing the join rows accordingly. Rough shape:

1. Add `userId` as nullable.
2. For each `(tag, user)` pair present in the join, ensure a tag row owned by that user.
3. Repoint `_ItemTags` rows at the owning user's tag.
4. Make `userId` non-null, add `@@unique([userId, name])`, drop `name @unique`.

**The decision:** whether to write that backfill properly, or — since production currently holds two
accounts, one of them a demo — take the far simpler path of assigning every existing tag to its
single owning user and failing loudly if any tag is shared. Ask before writing it.

Watch out for: `createItem` and `updateItem` in `src/actions/items.ts` both do "ensure these tags
exist" writes that assume the global uniqueness, and their comments say so. Both change.

## Follow-up from feature 1

**A scheduled orphan sweep.** `deleteUserObjects` handles the common path, but the crash window
between `prisma.user.delete` and the sweep leaves the same orphans it fixes — bounded now, not
unbounded. Closing it means a `/api/cron/sweep-orphaned-objects` route that lists the bucket's
`users/` prefixes and calls `deleteUserObjects` for every id with no `User` row: the same route +
`CRON_SECRET` + `vercel.json` pattern `/api/cron/sweep-unverified` established, and the mechanism it
would call already exists and is tested. Not urgent — the account path is correct without it.

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
