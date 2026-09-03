# Current Feature

## Status

Not Started

## Goals

<!-- Populated by `/feature load`. -->

## Notes

<!-- Populated by `/feature load`. -->

### Next up: code documentation, part 2

The source-documentation overhaul is under way. `context/features/code-docs-overhaul-spec.md` is the
authority — its four-part table carries the batching, and `context/coding-standards.md`
§ Documentation carries the standard itself.

**Parts 1a and 1b are done** (`src/config/` 8 files, entry 118; the server half, 39 files, entry
119). **Part 2 is next**: 61 files in five commits — `lib/` security and the data boundary 11 ·
`lib/` domain rules 11 · `lib/` AI and editor 10 · `app/api` 12 · `app/` pages 17. Load it with
`/feature load code-docs-overhaul-spec.md` and say **part 2**, since the spec describes all four
parts and cannot tell which one is starting.

Every pass ends with both proofs green: `npm run docs:comments-only` and `npm run docs:links`,
alongside `npm test`, `npm run lint` and `npm run build`.

**Two corrections land in part 2**, both noted in the spec: `lib/r2.ts` cites `current-feature.md`
for why the bucket is private (the rationale is in `project-overview.md` §10, Phase 4), and
`lib/rate-limit.ts` describes itself as throttling "the auth endpoints" and refers to "the five
budgets" — there are 11, covering uploads, checkout and the four AI actions.

**Two standard changes from part 1b apply from here on.** A module header goes **below** the
imports, with the first declaration given its own block so the header cannot attach to it. And no
paragraph opens by negating something — say what the thing is before ruling an alternative out.

### Standing items for Tom, not Claude

- **Set `CRON_SECRET` in Vercel** (Settings → Environment Variables → Production), then redeploy.
  Generate with `openssl rand -base64 32`. Until then the nightly sweep answers 503 and does
  nothing. `vercel.json` schedules it for 03:17 daily.
- **Confirm `AUTH_URL` is set in Vercel.** It is in the local `.env` and in `.env.example`, but not
  in `.env.production.example`, so the record does not say whether production has it.
- The next production deploy runs `prisma migrate deploy` — the tag migration is DDL plus a
  row-rewriting backfill.

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
