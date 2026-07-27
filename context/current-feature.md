# Current Feature: Auth UI — Sign In, Register & Sign Out

## Feature

Auth Phase 3. Replace NextAuth's built-in pages with custom `/sign-in` and `/register` routes, and turn the sidebar's existing user area into a working account menu with sign-out.

Spec: `context/features/auth-phase-3-spec.md` — used as a general guide; the goals below are adapted to this project's actual structure.

## Status

In Progress

## Goals

- Add the `(auth)` route group with `/sign-in` and `/register` pages, styled to match the dashboard shell and with no sidebar.
- Open both routes in `src/proxy.ts`. The matcher denies by default, so until they are excluded a signed-out visitor is redirected away from the very pages that let them sign in.
- Point NextAuth at the custom page with `pages: { signIn: "/sign-in" }` in `auth.config.ts`, and replace the hardcoded `/api/auth/signin` redirect in `proxy.ts`.
- Sign-in page: email + password fields, a "Sign in with GitHub" button, a link to `/register`, and inline error display for a rejected credential.
- Register page: name, email, password, confirm password; client-side validation reusing `registerSchema`; POST to the existing `/api/auth/register`; redirect to `/sign-in` on success.
- Extract the avatar markup from `SidebarNav` into a reusable component (GitHub `image`, else initials).
- Turn the sidebar user area into a dropdown: sign out, and a link to the profile page.
- Add `src/actions/auth.ts` with the sign-in / sign-out Server Actions.

## Notes

**Structural divergences from the spec — the reason this is a guide, not a checklist:**

- **The user area already exists** at the bottom of `SidebarNav.tsx:151`, already rendering the avatar with an image-or-initials fallback, name, and email. The spec reads as though this is new work; it is not. What is actually missing is the dropdown, the sign-out, and the profile link. There is a disabled "Settings" button sitting in that slot to replace.
- **`getInitials` already exists** in `src/lib/format.ts`, with tests in `format.test.ts`. The spec's "create a reusable avatar component" means extracting the *markup*, not reimplementing the logic.
- **The spec contradicts itself on placement.** Its overview says "bottom of sidebar"; testing step 4 says "verify avatar shows in top bar". This project puts it in the sidebar — follow the overview and ignore step 4.
- **`/dashboard` is not a URL here.** Post-sign-in redirect goes to `/`. Same translation as every previous auth phase.
- **`project-overview.md` §9 plans the route group as `(auth)/login/`,** but `proxy.ts` already documents the target as `/sign-in`, and the spec agrees. Going with `/sign-in`; §9 needs updating to match rather than being left to contradict the code.
- **`/profile` does not exist and is not in §9** — the planned route is `(dashboard)/settings/`. Either point the menu item at a stub `/profile` page or retarget it; do not ship a link to a 404.
- **`src/actions/` does not exist yet.** This feature creates it, so it sets the pattern for every mutation that follows.
- **shadcn has only `button` and `input` installed.** The dropdown needs `dropdown-menu` added; the avatar can stay hand-rolled since the markup already exists.
- `SidebarNav` is already `"use client"`, so the dropdown does not force a boundary change.

**Watch for:** `signIn("credentials", …)` throws `CredentialsSignin` on failure rather than returning a result — the form has to catch it and show a generic message, keeping the non-enumeration property Phase 2 established. Do not let the error distinguish a wrong password from an unknown email.

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
