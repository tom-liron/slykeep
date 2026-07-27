# Current Feature

## Feature

<!-- Feature Name and Short Description -->

## Status

<!-- Not Started | In Progress | Completed -->

## Goals

<!-- Goals and requirements -->

## Notes

<!-- Any extra notes -->

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
20. **Auth setup — NextAuth + GitHub** (`feature/auth-setup`) — Roadmap Phase 1: NextAuth v5 with the Prisma adapter and GitHub OAuth, on the split config pattern so the edge proxy never pulls in the adapter. Route protection denies by default rather than matching the spec's `/dashboard/*`, which is a route group and therefore not a URL here. `current-user.ts` now resolves the session with no demo-user fallback, since a default owner would hand signed-out requests shared data. The JWT type augmentation has to target `@auth/core/jwt` — `next-auth/jwt` is a bare re-export that declarations cannot reach.
21. **Auth credentials — email/password** (`feature/auth-credentials`) — Roadmap Phase 1, part 2: a Credentials provider beside GitHub and a `POST /api/auth/register` route handler, chosen over a Server Action so the client can tell 400 from 409. `auth.config.ts` holds a placeholder that always returns null and `auth.ts` substitutes the working provider *by id* — appending would leave the placeholder earlier in the array where every sign-in hits it first. All three failure modes (wrong password, unknown email, OAuth-only account) return null and pay the same bcrypt cost via a precomputed decoy hash; without it the miss answered in ~70ms against ~550ms for a hit. Zod validates both entry points from one schema, with email normalization piped *ahead* of validation, since chaining `.trim()` after `z.email()` transforms output that the anchored pattern has already rejected. Added `zod`, which the coding standards require but nothing had needed yet. Known gaps: a mixed-case GitHub email escapes the register route's lowercased duplicate check (needs citext), and neither endpoint is rate limited.
22. **Auth UI — sign in, register & account menu** (`feature/auth-ui`) — Auth Phase 3: an `(auth)` route group serving `/sign-in` and `/register`, plus a sidebar account menu with sign out and a `/profile` stub. The two routes are handled inside the proxy callback rather than excluded from its matcher, since an excluded path never runs the callback and a signed-in user could not then be redirected away from the sign-in form. Success toasts ride the redirect URL (`/?welcome=back|new`) because sign-in redirects from the server and the form is unmounted before it could raise one; `getFirstName` keeps the greeting from addressing people by the email fallback in `UserViewModel.name`. Errors all report inline, toasts are for successful auth only. Three things the spec did not anticipate: `noValidate` is required on the sign-in form or the browser rejects a malformed address silently and no message appears at all, lucide-react v1 dropped its brand icons so the GitHub mark is inlined, and sonner's shipped wiring to `next-themes` would have rendered light toasts over the dark app.
