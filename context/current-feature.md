# Current Feature: First-run polish — route files and demo content

## Status

Not Started

## Goals

- Add the four missing route files under `src/app`, which do not exist anywhere today:
  - `not-found.tsx` — a mistyped URL currently renders Next's default 404.
  - `error.tsx` — a thrown server component currently renders Next's default error screen.
  - `global-error.tsx` — the root-layout fallback.
  - `loading.tsx` — route-level skeletons; §10 Phase 3 records their absence as the one unfinished
    line in "Toasts, hover states, transitions".
  They must match the app's own shell: dark by default, the shared UI primitives, and a route back
  into the app rather than a dead end.
- Give a newly registered account something to look at, instead of an empty dashboard.
  `prisma/seed-data.ts` already holds usable demo collections and items, and only `prisma/seed.ts`
  reads it — the content exists, the registration path just never uses it.
- Respect the free-tier caps while doing it: seeded content must not put a new account at or over
  the 50-item / 3-collection limits that `lib/limits.ts` enforces.
- `npm test`, `npm run lint`, `npm run build` and `npm run docs:links` all pass.

## Notes

### Why these two together

Both are named in `context/portfolio-direction.md` §2 as gaps that outrank the deferred §11
backlog, and both are **independent of the rebrand**, so they can be built before the name is
chosen. They are the first two of the three topics listed at the top of `context/open-items.md`.

### Why it matters more than it looks

A reviewer opens the marketing page, signs up, and lands on a dashboard with zero items and zero
collections — so the item drawer, monaco, the four AI actions, the collection accents and ⌘K are all
invisible. The missing route files are the same failure from the other side: a stranger who mistypes
a URL or trips a server error sees Next's unstyled defaults on an otherwise finished product.

### Open decisions to settle first

- **Demo content: seeded on registration, or a shared read-only demo account?** §2 names both and
  picks neither. Seeding on registration gives every visitor a populated app and is the simpler
  path; a demo account avoids writing rows for people who never return, and needs a "Try the demo"
  entry point on the landing page. This has to be decided before implementing.
- **Which registration paths seed.** Credentials sign-up and GitHub OAuth arrive through different
  code (`api/auth/register` versus the `linkAccount` event in `src/auth.ts`), so "on registration"
  means two call sites, not one.
- **Whether seeded items count toward the free caps** — they will, since the caps read real rows.
  Keep the seed small enough that a new account is not immediately near a limit.

### Out of scope

- The rebrand, the domain, `metadataBase`, the OG image, `robots.txt` and `sitemap.ts` — one
  separate unit, and it waits on the new name.
- Cutting the `devstash` snapshot branch (`git push origin main:devstash`) — topic 3, a single
  command, tracked in `context/open-items.md`.

### Not outstanding, despite older notes

`CRON_SECRET` and `AUTH_URL` are both set and confirmed in Vercel Production as of 2026-09-05.

## History

Completed features are logged in `context/feature-history.md`.
