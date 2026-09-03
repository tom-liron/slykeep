# Open Items

Standing reminders and queued work that are **not tied to any one feature**, so they must not live
in `context/current-feature.md` (which `/feature complete` resets). Not `@`-imported by
`CLAUDE.md` — read it on demand, and when finishing or planning work.

---

## Deployment — Tom must do these in the Vercel dashboard

- **Set `CRON_SECRET`** (Settings → Environment Variables → Production), then redeploy. Generate
  with `openssl rand -base64 32`. Until it is set the nightly sweep at
  `/api/cron/sweep-unverified` answers 503 and does nothing. `vercel.json` schedules it for 03:17
  daily.
- **Confirm `AUTH_URL` is set in Production.** It is in the local `.env` and in `.env.example`, but
  not in `.env.production.example`, so the repo does not record whether production has it.
- The next production deploy runs `prisma migrate deploy`, and the tag migration is DDL plus a
  row-rewriting backfill — expect it to take longer than a schema-only migration.

## Tooling notes

- **`scripts/verify-comments-only.py` has a heuristic regex-literal lexer** (added in the docs
  overhaul, part 2a). It is preceding-token based, and was validated against `tsc --removeComments`
  and against its own prior output across all `src` files. If a future documentation pass makes it
  disagree with `tsc` on a file, suspect the heuristic, not the pass.

## Queued work (not the documentation overhaul)

- **Demo content for a new account** — a fresh sign-up currently lands on an empty dashboard.
- **The missing route files** — `error.tsx`, `not-found.tsx`, `loading.tsx`. Both this and the demo
  content are independent of the `devstash` rebrand and can land before that branch is cut.
- **Leftover from #117** — 17 `file.ts#L42` anchors across two tracked `docs/` files are checked by
  nothing; a link checker in CI would close it. And `docs/item-crud-architecture.md` links to
  `src/components/profile/ChangePasswordForm.tsx`, which no longer exists (its banner already names
  the replacement, so the dead link is documented rather than repaired).

## Documentation overhaul — remaining parts

The authority is `context/features/code-docs-overhaul-spec.md`. Current order:

1. **Part 5 — the re-sweep** (next). Re-read every file Parts 1a–3 touched against
   `coding-standards.md` § *Conclusion, not investigation*, folder by folder, its own branch.
   Start with `/feature load code-docs-overhaul-spec.md part 5`.
2. **Part 4 — the files outside `src/`** (~14 files: `next.config.ts`, `.env.example`,
   `prisma/schema.prisma`, `prisma/seed*.ts`, `vitest.integration.config.ts`, `scripts/`). Runs
   after Part 5. Start with `/feature load code-docs-overhaul-spec.md part 4`.
