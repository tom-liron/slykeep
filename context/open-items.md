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

All three are closed, and so is the rebrand they preceded: the name is **SlyKeep**, the domain is
**slykeep.com**, and the rename is complete — email (128), the site and app (139), the landing copy
(140), and the docs and repository metadata (144). The old "no *stash* as a noun" copy rule existed
only to survive the rename and no longer applies.

## Queued work

- **Verification hardening, three steps** — monaco 404ing on production, the verification link
  swallowed by an existing session, and the move to a soft verification gate. Each on its own
  branch; the plan and its progress checklist are in
  `context/features/verification-hardening-plan.md`.

- **Error monitoring (Sentry)** — decided, not started. The spec is
  `context/features/error-monitoring-spec.md`. The case for it is entry 164: production was down
  for hours and the only thing that reported it was a friend. Client-side errors are the larger
  half — Vercel logs server errors only, so a component throwing in a visitor's browser leaves no
  trace anywhere. Note what it does *not* cover before starting: every Server Action catches its
  own errors and returns `{ success, error }`, so none of them reach Sentry without a
  `captureException` pass over `src/actions/`.

- **Leftover from #117** — 17 `file.ts#L42` anchors across two tracked `docs/` files are checked by
  nothing; a link checker in CI would close it. And `docs/item-crud-architecture.md` links to
  `src/components/profile/ChangePasswordForm.tsx`, which no longer exists (its banner already names
  the replacement, so the dead link is documented rather than repaired).

## The Safe Browsing flag on slykeep.com — resolved

**Resolved 2026-09-15: Google passed the review** (filed 2026-09-14) and Search Console no longer
lists a security issue. The "Deceptive pages" flag had put a red interstitial on every visit,
the GitHub OAuth callback included. Google never named a trigger, so the fix addressed the two
strongest hypotheses (feature 139): a password form headed "Sign in to DevStash" on a days-old
domain called slykeep.com with nothing else crawlable, and subscription prices quoted while Stripe
runs on a test key.

What keeps it from coming back:

- **`/privacy` and `/terms` stay in `OPEN_ROUTES`.** `proxy.ts` is deny-by-default, so dropping
  them would serve a crawler the login form those pages exist to offset.
- **One name everywhere** — site, emails, Stripe Checkout and the GitHub OAuth app all say SlyKeep.
- **The `privacy@slykeep.com` alias stays live** (Namecheap redirect); the Privacy page publishes it.
- **Test-mode pricing stays disclosed** where checkout begins, on `/upgrade` and in the Terms.

If it is ever flagged again, Google gives no reason and re-requesting without a change slows each
review, so change something first — check Search Console for sample URLs, then add crawlable
content.

## Deployment

- **`CRON_SECRET` and `AUTH_URL` are both set in Vercel Production** — confirmed 2026-09-05, nothing
  outstanding. The nightly sweep at `/api/cron/sweep-unverified` is live on its 03:17 schedule.
- **`prisma migrate deploy` leads the Vercel build command** — since 2026-09-16, entry 164. Before
  that nothing applied a migration on deploy, and seven had accumulated since 8 September; the
  newest of them was what took production down. A build that cannot reach the database now fails
  rather than shipping code its data does not support, so a transient Neon cold start (P1001) fails
  the **whole deploy**. Redeploy — it is a cold-start race, not a configuration problem.
