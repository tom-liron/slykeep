# Current Feature: Code Documentation — Part 3 (the components)

## Status

In Progress

## Goals

- Document the 89 files in `src/components/` to `context/coding-standards.md` § Documentation:
  every file opens with a header explaining its role in the application, and every significant
  exported symbol is documented.
- Six commits, grouped so shared consumers are analysed once:
  - `ui/` — 20 files
  - `items/` — 18 files (the drawer trio held back)
  - `layout/` + `collections/` — 15 files
  - `marketing/` + `pricing/` + `billing/` — 16 files
  - `auth/` + `settings/` + `favorites/` + `dashboard/` — 17 files
  - **the drawer trio** — `ItemDrawer.tsx`, `ItemDrawerToolbar.tsx`, `ActionLabel.tsx` (3 files)
- Comments only — no behaviour change. Each pass ends with `npm run docs:comments-only` and
  `npm run docs:links` green, alongside `npm test`, `npm run lint` and `npm run build`.
- Constraints move to `@remarks` as present-tense rules; no history, symptoms, argument against
  roads not taken, or first person survives.
- Fix documentation defects in the pass that finds them; name each in that commit. Before deleting
  a substantial narrative block, confirm it is findable in `context/feature-history.md` (entry 88
  covers the `ItemCard` tag row and `h-full`; 96 the `ItemDrawerToolbar` width investigation; 105
  the drawer split) — if not, quote it in the commit body.

## Notes

`context/features/code-docs-overhaul-spec.md` is the authority — load it with
`/feature load code-docs-overhaul-spec.md part 3`. The standard itself is in
`context/coding-standards.md` § Documentation.

**Parts 1a, 1b and 2 are done** — `src/config/` (8 files, history entry 118), the server half
(39 files, entry 119), the middle — `lib/`, `app/api`, `app/` pages (55 files, entry 120).
Part 3 is `components/` — 45% of the overhaul, run last where a lost layout constraint costs the
most and the convention is long settled. **Part 4** (files outside `src/`) runs after Part 3.

### Standard as it stands after part 2

- Module header goes **below the imports**, separated from the first declaration by a blank line;
  the first declaration gets its own doc block so the header does not silently attach to it.
- A file with a `"use client"` / `"use server"` directive keeps it on line 1; the header still
  follows the imports.
- No paragraph opens by negating something ("Not `updatedAt`:", "Not a width breakpoint"). Say
  what the thing is and what it is for; introduce a plausible alternative before ruling it out.
- No history, symptoms, argument against roads not taken, or first person (including "we"/"our").
- Constraints live under `@remarks` as present-tense rules.
- `{@link}` only for symbols imported into or declared in the file; prose (symbol + module named
  in words) for anything else. `npm run docs:links` proves it.
- Depth follows non-obvious responsibility, not file size.

### The drawer trio is a reconciliation, not a rewrite

`ItemDrawer.tsx`, `ItemDrawerToolbar.tsx` and `ActionLabel.tsx` come last, held out of the
`items/` pass. Their comments no longer match their `className`s — a `justify-between`, a container
query and an `sm:` floor that are not in the files, and three incompatible sets of panel
measurements. Every surviving constraint must be checked against the actual markup first, and the
three files must agree afterwards.

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

- **Part 4 of the overhaul — the files outside `src/`** (added 2026-09-03). ~14 files in two
  commits: `next.config.ts`, `.env.example`, `prisma/schema.prisma`, `prisma/seed.ts`,
  `prisma/seed-data.ts`, `vitest.integration.config.ts`, and the 8 `scripts/` files. The spec's
  **Part 4** section carries the file-by-file state, what stays out, and the verification notes
  (`docs:comments-only` cannot see `.env.example` / `.prisma` / `.py`, so those get a hand check
  plus `npx prisma validate` and the build). Runs **after Part 3**. To start it later: `/clear`,
  then `/feature load code-docs-overhaul-spec.md part 4`, then `/feature start`.
- Independent of the rebrand, so they can land before the `devstash` branch is cut: **demo content
  for a new account**, and the missing **`error.tsx` / `not-found.tsx` / `loading.tsx`**.
- Left over from #117: 17 `file.ts#L42` anchors across two tracked `docs/` files are unchecked by
  anything — a link checker in CI would close it. And `docs/item-crud-architecture.md` links to
  `src/components/profile/ChangePasswordForm.tsx`, which no longer exists; its banner already names
  the replacement, so the dead link is documented rather than repaired.

## History

Completed features are logged in `context/feature-history.md`.
