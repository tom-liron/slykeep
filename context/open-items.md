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

1. ~~**The missing route files**~~ — **done 2026-09-06**, `feature/first-run-polish`
   (`feature-history.md` entry 126). `not-found.tsx`, `error.tsx`, `global-error.tsx` and a
   `loading.tsx` on the `(dashboard)` group, plus `not-found.tsx` and `error.tsx` **inside** that
   group, so an in-app 404 or a failed query keeps the sidebar and top bar.
2. ~~**Demo content for a new account**~~ — **done 2026-09-06**, same feature. Two collections and
   twelve items are written into every account as it is created, from both sign-up paths. The
   fixtures moved to `src/config/starter-content.ts`, which `prisma/seed-data.ts` now composes the
   demo account from.
3. ~~**Cut the `devstash` snapshot branch on GitHub**~~ — **done 2026-09-06**. `origin/devstash` is
   parked at `82b1625`, preserving the current identity and the completed course work before the
   rebrand renames it away. **Leave it there**: pushing to it again fast-forwards the snapshot to
   wherever `main` has moved, which is the opposite of what it is for. It reads as identical to
   `main` until the first rebrand commit lands, which is expected — the two diverge then.

All three are closed, and the naming decision is made: the name is **SlyKeep** and the domain
is **slykeep.com**. Transactional email has already moved onto it — `EMAIL_FROM` is
`SlyKeep <noreply@slykeep.com>` and the mail copy is renamed. Everything else the rebrand
touches — page titles, marketing copy, in-app strings, `AUTH_URL` — is still to do.

**A constraint the rebrand inherits:** new UI copy must not use "stash" as a *noun* ("your stash",
"in the stash") — the verb ("start stashing", "what you have stashed") is ordinary English and
survives the rename. The route files added in 1 use "dashboard" for every route back into the app
for this reason. Two pre-existing noun uses were left for the rebrand pass rather than fixed
piecemeal: `app/(dashboard)/profile/page.tsx`'s Usage panel and
`components/pricing/PricingPlans.tsx`.

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
