# Current Feature

## Status

Not Started — two features queued, in this order.

## Goals

Both were chosen on 2026-09-01 as "must happen before any real user touches the app". Two of the
three in that batch are already done (`feature/unverified-account-sweep`, and the production-database
guard that came out of building it); these are the remainder.

### 1. R2 objects outlive a deleted account — no decision needed, do this first

`deleteAccount()` in `src/actions/account.ts` deletes the `User` row and Postgres cascades every
item with it, but `deleteObject` in `src/lib/r2.ts` is called from exactly one place —
`src/actions/items.ts`, in `deleteItem`. So deleting an account leaves every uploaded file in the
bucket with nothing in the database pointing at it. **"Delete my account" does not delete their
files**, which is a retention promise the day there are real users, and it is unrecoverable in a way
the item-delete orphan is not: after the cascade there is no row left to read a key from.

Two approaches, both recorded in §11:

- **Delete up front.** Read the keys before deleting the row, delete the row, then delete the bytes.
  Accepts that a crash between the two leaves the same orphans it fixes — but bounded, and it makes
  the common path correct.
- **Scheduled prefix sweep.** Objects are keyed `users/<id>/…`, so a job can list the bucket by
  prefix and remove anything whose user no longer exists. Catches the crash case the first approach
  cannot, and now has somewhere obvious to live: `/api/cron/sweep-unverified` established the cron
  route + `CRON_SECRET` pattern, and `vercel.json` already holds a schedule to add to.

Doing the first and leaving the second as a follow-up is the likely shape. Note `endBillingRelationship`
already runs before the row is deleted, so `deleteAccount` has a precedent for "external cleanup,
best-effort, before the local delete".

**Test note:** `src/actions/account.test.ts` does not exist. The R2 client is mocked in
`src/lib/r2.test.ts`, so there is a pattern to copy.

### 2. Tag scoping — needs one decision from Tom before any code

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
