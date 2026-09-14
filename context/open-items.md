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

- **Original marketing copy** — the `/welcome` sections still carry the course instructor's wording
  almost verbatim, so the landing page reads as a near-copy of his DevStash app. The rebrand renamed
  the product but not its voice. Rewrite `Hero`, `FeatureGrid`, `AiSection`, `PricingPlans` and
  `CtaSection`, plus the copy they read from `config/marketing.ts` — `MARKETING_FEATURES`,
  `AI_HIGHLIGHTS` and the plan `note` strings. The "stash"-as-a-noun rule still applies, and any
  price change has to stay in step with `config/billing.ts` and `project-overview.md` §7. Its own
  branch and its own spec.


- **Verification hardening, three steps** — monaco 404ing on production, the verification link
  swallowed by an existing session, and the move to a soft verification gate. Each on its own
  branch; the plan and its progress checklist are in
  `context/features/verification-hardening-plan.md`.

- **Leftover from #117** — 17 `file.ts#L42` anchors across two tracked `docs/` files are checked by
  nothing; a link checker in CI would close it. And `docs/item-crud-architecture.md` links to
  `src/components/profile/ChangePasswordForm.tsx`, which no longer exists (its banner already names
  the replacement, so the dead link is documented rather than repaired).

## The Safe Browsing flag on slykeep.com

**Open as of 2026-09-10; review filed 2026-09-14, awaiting Google's decision.** Chrome shows a red "Deceptive site ahead" interstitial on every visit,
the GitHub OAuth callback included. Search Console is verified but lists **no sample URLs**, so the
trigger was never confirmed — everything below is remediation against the two strongest hypotheses,
both of which are now closed in the code (feature 139, `feature/slykeep-rebrand`):

- the site served a password form headed "Sign in to DevStash" from a days-old domain called
  slykeep.com, with nothing crawlable but a landing page and auth screens;
- it quoted subscription prices behind a "Go Pro" button while Stripe ran on a test key.

### The steps, in this order

1. **Add the `privacy@slykeep.com` forwarding alias** in Namecheap (Domain List → Manage → Domain
   tab → Redirect Email). The Privacy page publishes it, and an unreachable contact on a legal page
   is worse than none. — *done 2026-09-10, confirmed receiving.*
2. **Deploy**, then confirm **in incognito**: the `<title>` and wordmark read SlyKeep, and `/privacy`
   and `/terms` load **without** redirecting to `/sign-in`. That last check is the mechanism of the
   whole fix — they are in `OPEN_ROUTES` precisely so a session-less crawler can read them. — *done
   2026-09-14: all four of `/`, `/privacy`, `/terms`, `/sign-in` return 200 with no redirect, SlyKeep
   titles, and no "DevStash" in the served HTML.*
3. GitHub OAuth app — already renamed, callback URL included. Nothing to do.
4. **Then** Search Console → Security issues → Request Review. Describe it as a personal developer
   knowledge-hub app that was mid-rename; the domain and site branding are now consistent, Privacy
   and Terms are published, and the subscription pricing is a Stripe test-mode demonstration
   labelled as such where checkout begins. — *filed 2026-09-14.* The description also stated that the
   sign-in form serves only SlyKeep's own accounts, that GitHub sign-in runs through GitHub's own
   OAuth flow, and that the site offers no downloads — the two things a "social engineering" label
   actually means.

Step 4 is last on purpose: a review filed before the deploy is a review against the site that was
flagged, and it will be upheld.

### After filing

Reviews of this kind typically take a few days. A pass clears the interstitial within about a day of
the decision. **Google gives no reason for a refusal**, and re-requesting without having changed
anything makes each subsequent review slower — so if it is upheld, change something first. The
levers left, in order of expected value:

- **Give the domain more crawlable content.** This is the known remaining weakness: even now the
  site is a landing page, two legal pages and auth screens. An About page was built and dropped
  during 139 as redundant against the Terms — that judgment was about *duplication*, not about
  crawlable surface, and it is worth revisiting if the review fails.
- **Check for sample URLs again** in Search Console; they sometimes appear on a later scan and would
  replace all of this guessing with the actual answer.
- **Rewrite the marketing copy** (queued below). The current text is the course instructor's almost
  verbatim, which means the page is near-identical to another app on another domain — a duplication
  signal worth eliminating on its own merits, and possibly on these.

## Deployment

- **`CRON_SECRET` and `AUTH_URL` are both set in Vercel Production** — confirmed 2026-09-05, nothing
  outstanding. The nightly sweep at `/api/cron/sweep-unverified` is live on its 03:17 schedule.
- The next production deploy runs `prisma migrate deploy`, and the tag migration is DDL plus a
  row-rewriting backfill — expect it to take longer than a schema-only migration.
