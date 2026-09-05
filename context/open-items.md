# Open Items

Standing reminders and queued work that are **not tied to any one feature**, so they must not live
in `context/current-feature.md` (which `/feature complete` resets). Not `@`-imported by
`CLAUDE.md` — read it on demand, and when finishing or planning work.

---

## The three topics remaining before the domain

The domain arrives **with a new name** — decided, not open. That makes the rebrand and the domain
one piece of work, and none of it starts before these three land.
`context/portfolio-direction.md` §1 carries the reasoning: a domain name *is* a branding decision,
so buying before naming means buying twice and verifying the Resend domain twice.

1. **The missing route files** — `error.tsx`, `not-found.tsx`, `loading.tsx`, `global-error.tsx`.
   `find src/app` returns none of them, so a mistyped URL renders Next's default 404 and a thrown
   server component renders the default error screen. Both become visible to strangers the moment a
   domain makes the site reachable, and both read as unfinished.
2. **Demo content for a new account** — a fresh sign-up lands on an empty dashboard, which hides the
   item drawer, monaco, the four AI actions, the collection accents and ⌘K. `prisma/seed-data.ts`
   already holds usable content, and only the seed reads it.
3. **Cut the `devstash` snapshot branch on GitHub** — `git push origin main:devstash`, preserving the
   current identity and the completed course work before the rebrand renames it away. Only `main`
   exists on origin today.

1 and 2 are **one feature** and are independent of the name, so they can be built now. 3 is a single
command, and it must happen before the rebrand branch is cut.

## Queued work

- **Leftover from #117** — 17 `file.ts#L42` anchors across two tracked `docs/` files are checked by
  nothing; a link checker in CI would close it. And `docs/item-crud-architecture.md` links to
  `src/components/profile/ChangePasswordForm.tsx`, which no longer exists (its banner already names
  the replacement, so the dead link is documented rather than repaired).

## Deployment

- **`CRON_SECRET` and `AUTH_URL` are both set in Vercel Production** — confirmed 2026-09-05, nothing
  outstanding. The nightly sweep at `/api/cron/sweep-unverified` is live on its 03:17 schedule.
- The next production deploy runs `prisma migrate deploy`, and the tag migration is DDL plus a
  row-rewriting backfill — expect it to take longer than a schema-only migration.
