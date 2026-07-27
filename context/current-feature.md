# Current Feature: Auth Setup — NextAuth + GitHub Provider

## Feature

**Auth Phase 1** — NextAuth v5 with the Prisma adapter and GitHub OAuth, using NextAuth's default
sign-in page. Roadmap Phase 1; spec: `context/features/auth-phase-1-spec.md`.

## Status

In Progress

## Goals

- Install `next-auth@beta` (v5) and `@auth/prisma-adapter`.
- Split auth config for edge compatibility:
    - `src/auth.config.ts` — providers only, no adapter.
    - `src/auth.ts` — full config with the Prisma adapter and `session: { strategy: "jwt" }`.
- Add the GitHub OAuth provider.
- `src/app/api/auth/[...nextauth]/route.ts` — re-export the handlers from `auth.ts`.
- `src/proxy.ts` — route protection via the Next.js 16 proxy, named export
  `export const proxy = auth(...)`.
- `src/types/next-auth.d.ts` — extend `Session` with `user.id`.
- Redirect unauthenticated users to sign-in.
- Environment: `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` (local `.env` **and** Vercel).

## Notes

**Verify the API against Context7 before writing config** — the spec says so explicitly, and v5 is
still beta with moving conventions.

**Spec gotchas:** `next-auth@beta`, not `@latest` (that installs v4). The proxy file goes at
`src/proxy.ts`, the same level as `app/`. Named export, not default. Do not set a custom
`pages.signIn` — the default page is what this phase tests against.

**The spec's `/dashboard/*` path does not exist in this codebase.** `(dashboard)` is a route *group*,
so it contributes nothing to the URL: the protected routes are `/`, `/collections`,
`/collections/[id]`, and `/items/[slug]`. The proxy matcher has to cover those, and protecting a
literal `/dashboard/*` prefix would protect nothing. Worth confirming the intended matcher before
implementing.

**Delete the demo-user fallback outright.** `getCurrentUserId()` and `getCurrentUser()` in
`src/server/current-user.ts` currently resolve the hardcoded `demo@devstash.io` and throw when it is
missing. Replace both with the session lookup and remove the demo branch entirely — no
`?? DEMO_USER_EMAIL`, no default owner. Every read in the app is user-scoped through those two
functions, so a fallback would let signed-out requests read one shared pile of data: a silent auth
bypass, worse than today's loud throw. On a missing session, fail or redirect.

**Deployment state:** production has the seven system item types seeded but zero users, so real
signups resolve correctly once this lands. The deployed site 500s on every route until then. If the
Prisma adapter requires schema changes, the migration reaches production automatically via the
`prisma migrate deploy && next build` build step — but the three `AUTH_*` env vars must be added to
Vercel by hand.

**Follow-on work:** `context/features/auth-phase-2-spec.md` and `auth-phase-3-spec.md` exist; this
is the first of three.

## History

> One line per feature, newest last. Durable rules belong in `context/project-overview.md`, not here.

1. **Project foundation** (`6a86eb6`) — Stripped the create-next-app boilerplate, added `CLAUDE.md`, set up the `context/` docs folder.
2. **Dashboard UI Phase 1** (`feature/dashboard-phase-1`) — shadcn/ui init, dark mode by default, and the `(dashboard)` route group shell: sidebar, top bar, placeholder main area.
3. **Dashboard UI Phase 2** (`feature/dashboard-phase-2`) — Functional collapsible sidebar (item types with counts, favorite + recent collections, user area). Moved the brand into a full-width top bar so it survives collapse.
4. **Dashboard UI Phase 3** (`feature/dashboard-phase-3`) — Main content area: four stat cards, recent collections row, pinned items, recent items grid. Added `CollectionCard`, `ItemCard`, `StatCard`.
5. **Professional architecture refactor** — Server-only mock queries and explicit view models, read-only item/collection routes, fully derived collection metadata, accessible Radix mobile dialog.
6. **Source structure cleanup** — Separated type contracts from view models and runtime config; standardized module names.
7. **Post-refactor polish** — `[type]` → `[slug]`, shared `EmptyState`, narrowed `SidebarItemTypeViewModel`, dropped dead fallbacks in favor of failing fast on unknown item types.
8. **Prisma readiness cleanup** — Split item list summaries from full content records, made server-only boundaries explicit, added Pro-access scaffolding.
9. **Item-type identity alignment** (`feature/item-type-identity-alignment`) — Split item-type identity (database) from presentation (config), keyed by natural name. Renamed `ContentKind` → `ContentType` and split the overloaded `content` field into real `content` / `url` / `fileUrl` / `fileName` / `fileSize` columns.
10. **Prisma + Neon foundation** (`feature/prisma-neon-foundation`) — Roadmap Phase 0: Prisma 7.8 on Neon with schema, `init` migration, system-type seed, client singleton, and the `npm run db:test` smoke test. Closed the system-type uniqueness hole with a partial index (details in `project-overview.md` §5).
11. **Development seed data** (`feature/seed-data`) — Seeded a demo user, five collections, and eighteen items, made idempotent by delete-then-recreate scoped to the demo user. `Item.contentType` is derived from the item type so a mismatch is unrepresentable.
12. **Dashboard collections from the database** (`feature/dashboard-collections-db`) — Swapped the whole collection read path from mock to Prisma via `src/server/collections.ts` (dashboard, `/collections`, `/collections/[id]`, sidebar). Moved as a unit to avoid emitting real cuids into mock-resolved links, and added `force-dynamic` so rows aren't baked in at build time.
13. **Dashboard items from the database** (`feature/dashboard-items-db`) — Swapped the dashboard's pinned/recent lists and item stat cards to Prisma via `src/server/items.ts`, using counts + scoped queries like the collections module. Fixes the Items stat (16 → 18); sidebar nav and `/items/[slug]` stay mock.
14. **Sidebar item types & collection indicators from the database** (`feature/sidebar-stats-db`) — Moved the sidebar's item-type list (with live per-type counts) and the signed-in user off the mock `getSidebarNav` onto Prisma. Added a "View all collections" link and colored dominant-type dots for recent collections; favorites now lead with the star. Only `/items/[slug]` remains mock-backed.
15. **Retire the mock query layer** (`feature/items-slug-db`) — Moved the last mock-backed route, `/items/[slug]`, onto Prisma via `getItemTypePageData` in `src/server/items.ts`, then deleted `src/server/mock-data/` entirely. Reworked `view-models.test.ts` onto self-contained fixtures and dropped the mock-records tests. All reads are now Prisma end to end.
16. **Project skills** (`acd6889`) — Added `.claude/skills/` with three checked-in project skills: `cleanup` (housekeeping checks), `feature` (feature-workflow management), and `list-components`.
17. **Scan follow-ups** (`fix/scan-perf-and-comments`) — Acted on a codebase-scanner audit: memoized the request-scoped reads (`getCurrentUserId`, `getCurrentUser`, `getItemTypesById`) with React `cache()` to drop duplicate per-render queries, added a defensive `take` bound to the item-type page read, and refreshed two doc comments that still described the retired mock layer.
18. **Codebase-scanner agent** (`feature/codebase-scanner-agent`) — Checked in `.claude/agents/codebase-scanner.md`, a read-only Opus subagent that audits the codebase for security, performance, quality, and refactor findings, scoped to implemented code only (never flags planned/roadmap gaps) and briefed on the project's deliberate architectural divergences.
19. **Types-only seed** (`feature/seed-types-only`) — Added a `--types-only` flag to the seed (`npm run db:seed:types`) that writes the seven system item types and skips the demo user, collections, and items, then ran it against the Neon production branch, which had the `init` migration applied but no rows at all. Item types are reference data every `Item` FKs into, whereas the demo account's password lives in a committed file and must never reach a public deployment. The deployed site still throws until Phase 1 auth replaces the demo-user lookup in `getCurrentUserId()`.
