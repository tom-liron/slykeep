# Current Feature

## Status

Not Started

## Goals

<!-- Populated by `/feature load`. -->

## Notes

<!-- Populated by `/feature load`. -->

### Next up: code documentation, part 3

The source-documentation overhaul continues. `context/features/code-docs-overhaul-spec.md` is the
authority — its four-part table carries the batching, and `context/coding-standards.md`
§ Documentation carries the standard itself.

**Parts 1a, 1b and 2 are done** (`src/config/` 8 files, entry 118; the server half, 39 files, entry
119; the middle — `lib/`, `app/api`, `app/` pages — 55 files, entry 120). **Part 3 is last**: 89
files in `components/` across six commits — `ui/` 20 · `items/` 18 · `layout/` + `collections/` 15
· `marketing/` + `pricing/` + `billing/` 16 · `auth/` + `settings/` + `favorites/` + `dashboard/`
17 · the drawer trio 3. Load it with `/feature load code-docs-overhaul-spec.md` and say **part 3**.

**The drawer trio is a reconciliation, not a rewrite.** `ItemDrawer.tsx`, `ItemDrawerToolbar.tsx`
and `ActionLabel.tsx` come last and are held out of the `components/` pass: their comments no longer
match their `className`s (a `justify-between`, a container query and an `sm:` floor that are not in
the file; three incompatible sets of panel measurements). Every surviving constraint there has to
be checked against the actual markup first, and the three must agree afterwards.

Every pass ends with both proofs green: `npm run docs:comments-only` and `npm run docs:links`,
alongside `npm test`, `npm run lint` and `npm run build`.

**Standard as it stands after part 2.** Module header **below** the imports, first declaration given
its own doc block. No paragraph opens by negating something. No history, symptoms, argument against
roads not taken, or first person (including "we"/"our"). Constraints live under `@remarks` as
present-tense rules. `{@link}` only for symbols imported into or declared in the file; prose (symbol
+ module) for anything else.

### Standing items for Tom, not Claude

- **Set `CRON_SECRET` in Vercel** (Settings → Environment Variables → Production), then redeploy.
  Generate with `openssl rand -base64 32`. Until then the nightly sweep answers 503 and does
  nothing. `vercel.json` schedules it for 03:17 daily.
- **Confirm `AUTH_URL` is set in Vercel.** It is in the local `.env` and in `.env.example`, but not
  in `.env.production.example`, so the record does not say whether production has it.
- The next production deploy runs `prisma migrate deploy` — the tag migration is DDL plus a
  row-rewriting backfill.
- **`scripts/verify-comments-only.py` gained a regex-literal lexer in part 2a.** It is a heuristic
  (preceding-token based) and was validated against `tsc --removeComments` and against its own old
  output across all 245 `src` files. If a future pass makes it disagree with `tsc` on a file, the
  heuristic is the thing to check, not the pass.

### Queued behind the documentation work

- Part 3 of the overhaul: 89 files in `components/`, plus the drawer trio held back for
  reconciliation.
- Independent of the rebrand, so they can land before the `devstash` branch is cut: **demo content
  for a new account**, and the missing **`error.tsx` / `not-found.tsx` / `loading.tsx`**.
- Left over from #117: 17 `file.ts#L42` anchors across two tracked `docs/` files are unchecked by
  anything — a link checker in CI would close it. And `docs/item-crud-architecture.md` links to
  `src/components/profile/ChangePasswordForm.tsx`, which no longer exists; its banner already names
  the replacement, so the dead link is documented rather than repaired.

## History

Completed features are logged in `context/feature-history.md`.
