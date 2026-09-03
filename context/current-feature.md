# Current Feature

## Status

Not Started

## Goals

<!-- Populated by `/feature load`. -->

## Notes

<!-- Populated by `/feature load`. -->

### Next up: code documentation, part 1b

The source-documentation overhaul is under way. `context/features/code-docs-overhaul-spec.md` is the
authority — its four-part table carries the batching, and `context/coding-standards.md`
§ Documentation carries the standard itself.

**Part 1a is done** (`src/config/`, 8 files, entry 118). **Part 1b is next**: 39 files in three
commits — `types/` 10 + `hooks/` 6 · `server/` 13 · `actions/` 7 + `auth.ts`, `auth.config.ts`,
`proxy.ts` 3. Load it with `/feature load code-docs-overhaul-spec.md` and say **part 1b**, since the
spec describes all four parts and cannot tell which one is starting.

Every pass ends with both proofs green: `npm run docs:comments-only` and `npm run docs:links`,
alongside `npm test`, `npm run lint` and `npm run build`.

**One correction lands in part 1b:** `src/actions/items.ts` calls `Tag` rows "global and shared
across users". Tags have carried `userId` and `@@unique([userId, normalized])` since #112. The other
two known corrections are in `lib/`, so they belong to part 2.

### Standing items for Tom, not Claude

- **Set `CRON_SECRET` in Vercel** (Settings → Environment Variables → Production), then redeploy.
  Generate with `openssl rand -base64 32`. Until then the nightly sweep answers 503 and does
  nothing. `vercel.json` schedules it for 03:17 daily.
- **Confirm `AUTH_URL` is set in Vercel.** It is in the local `.env` and in `.env.example`, but not
  in `.env.production.example`, so the record does not say whether production has it.
- The next production deploy runs `prisma migrate deploy` — the tag migration is DDL plus a
  row-rewriting backfill.

### Queued behind the documentation work

- Independent of the rebrand, so they can land before the `devstash` branch is cut: **demo content
  for a new account**, and the missing **`error.tsx` / `not-found.tsx` / `loading.tsx`**.
- Left over from #117: 17 `file.ts#L42` anchors across two tracked `docs/` files are unchecked by
  anything — a link checker in CI would close it. And `docs/item-crud-architecture.md` links to
  `src/components/profile/ChangePasswordForm.tsx`, which no longer exists; its banner already names
  the replacement, so the dead link is documented rather than repaired.

## History

Completed features are logged in `context/feature-history.md`.
