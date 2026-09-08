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

- **Verification hardening, three steps** — monaco 404ing on production, the verification link
  swallowed by an existing session, and the move to a soft verification gate. Each on its own
  branch; the plan and its progress checklist are in
  `context/features/verification-hardening-plan.md`.

- **Leftover from #117** — 17 `file.ts#L42` anchors across two tracked `docs/` files are checked by
  nothing; a link checker in CI would close it. And `docs/item-crud-architecture.md` links to
  `src/components/profile/ChangePasswordForm.tsx`, which no longer exists (its banner already names
  the replacement, so the dead link is documented rather than repaired).

## Deployment

- **`CRON_SECRET` and `AUTH_URL` are both set in Vercel Production** — confirmed 2026-09-05, nothing
  outstanding. The nightly sweep at `/api/cron/sweep-unverified` is live on its 03:17 schedule.
- The next production deploy runs `prisma migrate deploy`, and the tag migration is DDL plus a
  row-rewriting backfill — expect it to take longer than a schema-only migration.

---

## Toast spam on repeated clicks

**Raised 2026-09-08.** Clicking a control with a toast attached — Copy, Favorite, Pin — as fast as
you can produces one toast per click, stacked. It predates the verification work and affects
controls that feature never touched, which is why it is here rather than in a feature file.

Rate limiting is the wrong tool: that is server-side abuse protection, and this is presentation.
Two mechanisms are the accepted answer, and they apply to different controls:

- **Copy should not raise a toast at all.** Anchor the confirmation to the button — swap the icon to
  a check and the label to "Copied" for about two seconds. Feedback belongs where the action
  happened; a toast is for when the control is far from where the user is looking, which is never
  true of a button they just pressed. This is what GitHub and most snippet UIs do.
- **Favorite and Pin keep their toasts, with a stable `id`.** Sonner replaces a toast of the same
  id and restarts its timer rather than stacking, so a burst of clicks leaves one toast. It is one
  argument per call site and needs no new machinery.

`visibleToasts` on the `<Toaster>` (sonner's default is 3) caps the pile but still queues the rest,
so it is a backstop rather than the fix.

Sources: [why toasts are wrong for button
confirmations](https://uxmovement.substack.com/p/why-toasts-arent-the-best-for-button), [toast
dedup and the rage-click case](https://blog.vibecoder.me/toast-notifications-feedback-patterns-tutorial).

### Also in scope when this is picked up

`TOAST_DURATION_MS` in `src/components/ui/sonner.tsx` was raised from sonner's 4s default to 6s so
the longest refusal messages can be read. It landed in the soft-gate commit because it was asked for
mid-flow, but it is toast work rather than verification work. Sonner has no per-type duration, so
the success toasts inherit it; if that turns out to be too long for a two-word confirmation, the
only way to split them is a small wrapper the call sites use instead of `toast.error` directly.
