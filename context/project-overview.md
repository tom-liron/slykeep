# SlyKeep — Project Overview

> One fast, searchable, AI-enhanced hub for all developer knowledge and resources.

---

## 1. The Problem

Developers keep their essentials scattered across too many tools:

- Code snippets in VS Code or Notion
- AI prompts buried in chat histories
- Context files lost inside projects
- Useful links in browser bookmarks
- Docs in random folders
- Commands in `.txt` files or shell history
- Project templates in GitHub gists

The result is constant context switching, lost knowledge, and inconsistent workflows.

**SlyKeep** solves this by providing a single, fast, searchable, AI-enhanced hub for everything a developer needs to stash and retrieve.

---

## 2. Target Users

| User | Primary Need |
|------|--------------|
| **Everyday Developer** | Quickly grab snippets, prompts, commands, and links |
| **AI-first Developer** | Save prompts, contexts, workflows, and system messages |
| **Content Creator / Educator** | Store code blocks, explanations, and course notes |
| **Full-stack Builder** | Collect patterns, boilerplates, and API examples |

---

## 3. Core Concepts

```
USER
 ├── owns ITEMS ──────────┐
 │                        ├── tagged with TAGS
 │                        ├── classified by an ITEMTYPE
 │                        └── belong to many COLLECTIONS (via ITEMCOLLECTION)
 └── owns COLLECTIONS ─────┘
```

- **Item** — the atomic unit (a snippet, prompt, note, command, file, image, or link).
- **ItemType** — categorizes an item. Ships with fixed system types; custom types come later (Pro).
- **Collection** — a user-defined group that can hold items of any type.
- **ItemCollection** — join table; an item can live in many collections at once.
- **Tag** — free-form labels for search and organization.

---

## 4. Features

### A. Items & Item Types

Items have a type. Users will eventually create **custom types**, but we launch with these **system types** (immutable):

| Name | Label | Content Type | Route | Pro Only |
|------|-------|--------------|-------|----------|
| `snippet` | Snippets | `TEXT` | `/items/snippets` | — |
| `prompt` | Prompts | `TEXT` | `/items/prompts` | — |
| `note` | Notes | `TEXT` | `/items/notes` | — |
| `command` | Commands | `TEXT` | `/items/commands` | — |
| `link` | Links | `URL` | `/items/links` | — |
| `file` | Files | `FILE` | `/items/files` | ✅ |
| `image` | Images | `FILE` | `/items/images` | ✅ |

**Name** is the persisted natural key. **Label**, **content type**, **route**, and Pro gating are application configuration (`config/item-type-catalog.ts`), not database columns — see §5.

Items should be **quick to access and create** via a slide-out drawer.

### B. Collections

Users create collections that hold items of **any** type. An item can belong to **multiple** collections — e.g. a React snippet in both *React Patterns* and *Interview Prep*.

Examples:

- **React Patterns** — snippets, notes
- **Context Files** — files
- **Python Snippets** — snippets

### C. Search

Powerful search across **content**, **tags**, **titles**, and **types**.

### D. Authentication

Email / password **or** GitHub sign-in.

### E. Productivity Features

- Favorite collections and items
- Pin items to the top
- Recently used
- Import code from a file *(not built — Phase 4)*
- Markdown editor for text types
- File upload for file types (file / image)
- Export data in multiple formats *(not built — Phase 4; deliberately not promised on the pricing card)*
- Dark mode (default for devs), light mode optional *(dark ships; there is no toggle yet — Phase 1)*
- Add / remove items to / from multiple collections
- View which collections an item belongs to

### F. AI Features (Pro only)

- AI auto-tag suggestions
- AI summaries
- AI "Explain This Code"
- Prompt optimizer

---

## 5. Data Model (Prisma)

> Prisma 7 on PostgreSQL (Neon). This is the migration target: the persisted shape only.
> **Rule:** never use `prisma db push` or edit the DB structure directly. All schema changes go through **migrations**, run in dev first, then prod.

**Identity vs. presentation.** `ItemType` persists only `{ id, name, icon, color, isSystem, userId }`. The *name* is the natural key — lowercase singular (`snippet`, `prompt`, …). Everything else an item type needs in order to render — its plural display label, its route slug, its content type, and whether it is Pro-gated — is application configuration in `config/item-type-catalog.ts`, keyed by that name. The two are joined into an `ItemTypeViewModel` at the server boundary, which is also where the persisted `icon` string is validated against the supported icon set.

Note that `contentType` lives on **Item**, not on `ItemType`: it is a property of the stored content, and it discriminates which of `content` / `url` / `fileUrl` is populated.

**The schema itself lives in `prisma/schema.prisma`** — that file is authoritative and this document
does not duplicate it. It was inlined here until it drifted (the copy lost the partial index's
`map:`), and a second copy of 200 lines of schema is a maintenance liability, not documentation.
Read `prisma/schema.prisma` when you need the persisted shape; what follows is the reasoning behind
it, which the schema file cannot carry.

Models, in order: `User`, `Account`, `Session`, `VerificationToken`, `ContentType` (enum), `Item`,
`ItemType`, `Collection`, `ItemCollection`, `Tag`.


> **Notes / open questions**
> - **The system-type unique constraint is enforced by a partial index.** `@@unique([name, userId])` alone does not constrain system types: their `userId` is `NULL`, and Postgres treats `NULL`s as distinct in unique indexes, so two `('snippet', NULL)` rows would both be accepted. A second, partial unique index — `@@unique([name], where: { userId: null })`, via the `partialIndexes` preview feature — closes it. Declaring it in the schema (rather than hand-writing the SQL in `migration.sql`) is required: since 7.4, Prisma treats database objects it cannot see in the schema as drift and emits a `DROP` for them on every `migrate dev`.
> - **Never `findUnique` an item type by `name` alone.** A [Prisma bug](https://github.com/prisma/prisma/issues/29282) leaks `name` into `ItemTypeWhereUniqueInput` because of that partial index, so it type-checks — but `name` is unique only among *system* rows, and a user's custom type may share it. Use `findFirst({ where: { name, userId: null } })`.
> - Seed the seven system types from `config/item-type-catalog.ts` (name, icon, color). The seed is the only place the catalog's colors and icons flow into the database. It reads-then-writes rather than `upsert`ing, for the same `NULL` reason.
> - **`Tag` is scoped per user**, not global. `name` holds the spelling that gets rendered (`PostgreSQL`, `React`); `normalized` holds `lower(trim(name))` and carries the `@@unique([userId, normalized])` constraint, so one account cannot hold `react` and `React` as two tags while both still display as typed. `normalized` is a real column rather than a functional index or `citext` because the write paths must *connect* by it, and Prisma can only target a column. Case folding is the only collapsing done: `react` and `reactjs` are different strings and nothing can know they mean the same thing — that is what tag autocomplete is for. Tags now cascade from `User`, so a deleted account takes them with it.
> - `Item.contentType` is denormalized against its `ItemType` — a "snippet" is always `TEXT`. Enforced at the write boundary (Server Actions), not by the schema.
> - UI view models normalize nullable database fields such as `User.name`, `Item.description`, and `Collection.description` into display-safe values, and serialize `DateTime` to ISO strings. List view models must not select item bodies; detail queries select content only when the detail drawer/page needs it.
> - A collection with no items and no `defaultTypeId` has **no** dominant type. `CollectionViewModel.dominantItemType` is nullable, and the card renders a neutral accent in that case.

## 6. Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| **Framework** | Next.js 16 / React 19 | SSR pages + dynamic components; one repo |
| **Language** | TypeScript | Type safety throughout |
| **Backend** | Next.js API routes | Items, file uploads, AI calls |
| **Database** | Neon (PostgreSQL) | Cloud Postgres |
| **ORM** | Prisma 7 | Migrations only — never `db push` (fetch latest docs) |
| **Rate limiting** | Upstash Redis | Sliding windows on the auth and AI entry points. Redis rather than process memory because this deploys serverless. *Caching* hot reads is still only a maybe — see §11 |
| **File Storage** | Cloudflare R2 | File / image uploads |
| **Auth** | NextAuth v5 | Email/password + GitHub OAuth |
| **AI** | OpenAI `gpt-5-nano` | Tagging, summaries, explain, prompt optimize |
| **Styling** | Tailwind CSS v4 + shadcn/ui | Component library |

> ⚠️ **Migration discipline:** Always create a migration, run it in dev, then promote to prod. Never mutate the production schema directly.

---

## 7. Monetization (Freemium)

| | **Free** | **Pro — $8/mo or $72/yr** |
|---|----------|----------------------------|
| Items | 50 total | Unlimited |
| Collections | 3 | Unlimited |
| System types | All except file/image | All |
| File & image uploads | ❌ | ✅ |
| Custom types | ❌ | ✅ *(later)* |
| ⌘K search | ✅ | ✅ |
| AI auto-tagging | ❌ | ✅ |
| AI code explanation | ❌ | ✅ |
| AI prompt optimizer | ❌ | ✅ |
| Support | — | Priority |

> **This table is the shipped state, not a plan.** `ENFORCE_PRO_LIMITS` is `true`, so the item and
> collection caps, the file/image type gate, and the four AI actions all refuse for real. It matches
> the pricing cards in `config/marketing.ts`, which are what a visitor actually reads — keep the two
> in step. Two rows were wrong until the documentation overhaul: search was listed as `Basic | Basic`,
> comparing nothing, and export was promised on both sides after its row had been deliberately pulled
> from the shipped card for having no route behind it. Search is one feature for everyone,
> deliberately; export is Phase 4 work that has not been built.

---

## 8. UI / UX

### General Direction

- Modern, minimal, developer-focused; syntax highlighting for code blocks
- **Dark only.** The `.dark` palette in `globals.css` is the design; the light `:root` block is unused
  until a light-mode feature restyles it
- **Layered surfaces:** a near-black frame (top bar and sidebar, `#0E0E10`) around a lighter work area
  (`#1A1A1D`), with cards and dialogs a clear step up (`#26262B`); subtle borders
- **Gold brand accent `#F2B544`** — primary buttons, the logo, favourites and focus. The item-type
  palette below keeps clear of it (prompts are orange, not gold)
- **Brand mark:** a gold fox tile, used by `Brand.tsx`, the favicon set in `src/app/` and
  `public/brand/slykeep-icon-512.png`. Stripe Checkout and the Customer Portal carry the same icon
  and accent, set in the Stripe Dashboard rather than in code
- **Type:** Rethink Sans across the app, Geist Mono for monospace, Mona Sans (expanded, weight 700)
  on the landing page's headlines only
- **References:** Notion, Linear, Raycast
- Full token values: `context/features/redesign-spec.md`; source of truth is `globals.css` and
  `config/item-type-catalog.ts`

### Layout

```
┌─────────────────────────────────────────────────────┐
│ TOP BAR: brand, sidebar toggle, search, actions      │
├──────────────┬──────────────────────────────────────┤
│ SIDEBAR      │ MAIN                                 │
│ (collapsible)│                                      │
│              │ ┌───────┐ ┌───────┐ ┌───────┐       │
│ Item Types   │ │ Coll. │ │ Coll. │ │ Coll. │       │
│ Favorites    │ └───────┘ └───────┘ └───────┘       │
│ Recent       │                                      │
│ Collections  │ ┌─────────────── item rows ────────┐ │
│              │ └──────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────┘
        Item opens in a quick-access DRAWER ▸
```

- **Top bar:** brand, responsive sidebar controls, search, and create actions.
- **Sidebar:** item types (each linking to its items list), favorite collections, and recently updated collections.
- **Main:** collection cards use a colored left accent for their dominant type. Items use a matching colored left border.
- **Drawer:** an item opens in a fast slide-out drawer for view / edit / create — `ItemDrawer` plus `ItemDrawerToolbar`, which carries Favorite, Pin, Copy, Download and Edit on one row over whatever page you were already on.

Collection recency is based on `updatedAt`. The dominant type is the most common item type in the collection; if counts tie, the type of the most recently updated tied item wins. Empty collections use `defaultTypeId`.

### Type Colors & Icons

Icons are [lucide-react](https://lucide.dev) names.

| Type | Color | Swatch | Icon |
|------|-------|--------|------|
| Snippet | `#3b82f6` (blue) | 🟦 | `Code` |
| Prompt | `#8b5cf6` (violet) | 🟪 | `Sparkles` |
| Command | `#f97316` (orange) | 🟧 | `Terminal` |
| Note | `#fde047` (yellow) | 🟨 | `StickyNote` |
| File | `#94A3B8` (slate) | ⬜ | `File` |
| Image | `#ec4899` (pink) | 🩷 | `Image` |
| Link | `#10b981` (emerald) | 🟩 | `Link` |

### Responsive

- Desktop-first, but fully usable on mobile.
- Sidebar collapses into a drawer on mobile.

### Micro-interactions

- Smooth transitions
- Hover states on cards
- Toast notifications for actions
- Loading skeletons

---

## 9. Project Structure

The layout below is the shape of the repository, one line per directory. It deliberately does not
list files: `src/` holds roughly 250 of them, a hand-maintained inventory drifts within a feature or
two of being written, and every file carries a header explaining its own role. Read the directory
and the headers in it. What follows the tree is the part a listing cannot show — the rules that
decide which directory a new file belongs in.

```
slykeep/
├── prisma/                  # schema.prisma (authoritative persisted shape), migrations, seed
├── prisma.config.ts         # Prisma 7 CLI config: schema path, migrations, seed, datasource
├── scripts/                 # one-off and maintenance scripts, each behind an npm script
├── public/                  # the monaco build, copied from node_modules; gitignored, never edited
├── docs/                    # plan and architecture records, written once and not maintained;
│                            # every file carries a "not maintained" banner. Where one disagrees
│                            # with `src/`, code wins
├── src/
│   ├── app/                 # routes. Route groups: (marketing) signed-out landing, (auth)
│   │   │                    # signed-out card shell, (dashboard) the authed app
│   │   └── api/             # route handlers — auth, upload, files, cron, the Stripe webhook
│   ├── components/          # by feature: ui, auth, items, collections, layout, billing,
│   │                        # pricing, marketing, settings, favorites, dashboard
│   ├── generated/prisma-client/  # build output: gitignored, never edited
│   ├── lib/                 # client-safe shared modules — importable from anywhere
│   ├── actions/             # Server Actions: the write side
│   ├── server/              # server-only reads, view models, and infra/ (the integration
│   │                        # clients: prisma, stripe, r2, openai, email, rate-limit, app-origin)
│   ├── hooks/               # custom React hooks
│   ├── types/               # compile-time contracts
│   ├── config/              # runtime values satisfying those contracts
│   ├── auth.ts              # node half of NextAuth: adapter, JWT callbacks, real authorize
│   ├── auth.config.ts       # edge-safe half: providers + pages, no adapter
│   └── proxy.ts             # deny-by-default route protection (edge)
├── vercel.json              # the nightly cron schedule for /api/cron/sweep-unverified
├── vitest.config.ts         # unit tests, beside the module as *.test.ts; excludes
│                            # *.integration.test.ts so `npm test` stays offline
├── vitest.integration.config.ts  # tests that talk to real services (billing:test, r2:test)
├── vitest.server-only.ts    # stubs the `server-only` import so server modules are testable
├── .env                     # secrets (gitignored); .env.example documents the names
└── package.json
```

A few deliberate choices worth noting: route groups `(auth)` and `(dashboard)` keep the signed-out and signed-in shells separate without affecting URLs — which is exactly why the sign-in page is `/sign-in` and the dashboard is `/`, never `/dashboard`. `types/` contains compile-time contracts, while `config/` contains runtime values that satisfy those contracts. A single `config/item-type-catalog.ts` is the source of truth for built-in item type colors, icons, and routes. The `server/` directory owns everything server-only — read-side persistence access, persistence-independent view models, and the integration clients under `server/infra/` — while `actions/` owns write-side Server Actions. That split is the whole of one rule, and it has no exceptions: **`@/lib/*` is safe to import from anywhere; `@/server/*` is not.** `lib/` therefore holds only modules a client component may pull in, and an ESLint override on `src/lib/**` enforces it by refusing `server-only` and `@/server/*` imports there. Reads go through Prisma end to end; the earlier mock query layer has been fully retired.

Mutations are split between `actions/` and `api/` on one rule: a Server Action when the caller only needs success or a message, a route handler when it needs to read an HTTP status. That is why registration is a route — the client distinguishes a 400 from a 409 — while changing a password and deleting an account are actions. The two halves of the auth config exist because `proxy.ts` runs on the edge: `auth.config.ts` holds what is edge-safe, and `auth.ts` adds the Prisma adapter and the real `authorize` on top of it.

---

## 10. Next Steps / Roadmap

A phased build order. Each phase is shippable on its own and de-risks the next. The completed `context/features/dashboard-phase-*.md` documents describe earlier UI-only increments; they are not the same as the product roadmap phases below.

**Phase 0 — Prisma Foundation ✅ done**
- ~~Set up Neon, connect Prisma, write the first migration (`init`)~~
- ~~Seed the seven system `ItemType` rows~~
- ~~Configure `.env.example` and the Prisma client singleton~~

**Phase 1 — Auth & Shell ✅ done, bar the light-mode toggle**
- ~~NextAuth v5 with email/password + GitHub OAuth~~ — plus email verification, password reset, and the account page
- ~~Protected `(dashboard)` layout with collapsible sidebar~~ — the proxy denies by default
- Dark mode (default) + light mode toggle — dark ships; there is no theme provider or toggle yet
- Deferred out of this phase: rate limiting on the auth endpoints, and session revocation (see §11)

**Phase 2 — Core CRUD ✅ done, bar "recently used"**
- ~~Create / read / update / delete items via the quick-access drawer~~
- ~~Markdown editor for text types, syntax highlighting for code~~ — monaco for code, served from
  this origin rather than a CDN; a plain textarea replaces it on a coarse pointer
- ~~Collections: create, color-coding logic, add/remove items, many-to-many~~
- ~~Favorites~~ — items and collections both toggle from their existing star controls, and
  `/favorites` lists everything starred
- ~~Pinning~~ — `toggleItemPin` writes `Item.isPinned`, and pinned items sort first on every listing
- ~~**"Recently used"**~~ — done 2026-09-02. `touchCollections()` moves a collection's `updatedAt`
  from all three item write paths, so "recent" means last *activity* rather than "newest". See §11

**Phase 3 — Search & Polish**
- ~~Search across tags, titles, types~~ — the ⌘K command palette, matching client-side over
  prefetched summaries. Item **content** is deliberately not searched: list queries never read the
  body (§5), so full-content search needs a server-side query rather than a wider prefetch
- ~~Toasts, hover states, transitions~~ — sonner with `richColors`, the micro-interactions in §8, and
  a route-level `loading.tsx` on the `(dashboard)` group, so a navigation paints a skeleton in the
  main pane while the shell around it holds still
- ~~Mobile responsiveness (sidebar → drawer)~~ — plus the phone-width passes on the item drawer, the
  dialogs, and the file rows, and the 44px touch-target policy in `ui/button.tsx`

**Phase 4 — Files (Pro) — uploads done, the two import/export lines open**
- ~~Cloudflare R2 uploads for file/image types~~ — through `POST /api/upload`, which authorizes the
  request and puts the object itself. **Not** presigned URLs, as this line originally said: the
  browser never talks to R2, so the bucket needs no public write path and the size, extension and
  MIME rules in `lib/file-constraints.ts` are enforced somewhere the client cannot skip.
  `GET /api/files/[id]` streams an object back, authorized per request
- Import code from a file — still open; nothing reads a local file into the content field
- Export data (JSON / ZIP) — still open. Note that the Pro pricing card no longer promises it: the
  row was pulled rather than left advertising a feature with no route behind it

**Phase 5 — AI (Pro) ✅ done**
- ~~OpenAI `gpt-5-nano` integration: auto-tagging, summaries, explain-this-code, prompt optimizer~~ —
  all four ship as Server Actions in `actions/ai.ts`, not as API routes: no caller needs an HTTP
  status. Each is gated by `canUseAi` and rate-limited per user through its own bucket, and each
  prompt and its response parsing lives in its own `lib/ai-*.ts` module so the rules are unit-testable
  without a network call

**Phase 6 — Monetization ✅ done**
- ~~Stripe checkout + customer portal + webhook~~ — plus the account-deletion gate, which refuses
  to delete an account while a subscription would still bill, and asks Stripe rather than the local
  row so a missed webhook cannot wave someone through
- ~~Flip on free-tier gates (50 items / 3 collections / no files / no AI)~~ — `ENFORCE_PRO_LIMITS`
  is now `true`, so the item and collection caps and the file/image type gate all refuse for real.
  AI is gated too — `actions/ai.ts` checks `canUseAi` before every one of the four actions. Export
  is the only Pro line with no code behind it to gate (Phase 4). The demo seed was cut to three
  collections to match the tier it runs as

**Phase 7 — Launch prep**
- Custom item types
- Priority support path, error monitoring, analytics
- ~~A domain, and `EMAIL_FROM` on it.~~ — the domain is `slykeep.com` and `EMAIL_FROM` is
  `SlyKeep <noreply@slykeep.com>`, which `server/infra/email.ts` also carries as its default.
  Delivery still depends on that domain reading **verified** at https://resend.com/domains: Resend
  refuses every recipient of an unverified sender with a 403, which surfaces as registration
  completing and then reporting that the confirmation email could not be sent.
  `npm run email:test -- <address>` settles it either way.
- ~~The DevStash → SlyKeep rename.~~ — the site, the app and the README in
  `feature/slykeep-rebrand`; the project docs, agent definitions and `package.json` in
  `fix/finish-rebrand`.

---

## 11. Open Questions & Things to Decide

Worth nailing down before or early in the build, so they don't force a rewrite later. Questions
that have since been settled are recorded in `context/decisions.md` — read it before proposing a
change to any of these areas, since several plausible-looking courses were considered and ruled
out there.

- **File handling.** Max file size, allowed MIME types, and whether deleting an item also deletes the R2 object (orphan cleanup).
- **OAuth emails are not normalized, credentials emails are.** `auth-schemas.ts` lowercases and trims every address that arrives through registration or sign-in; the GitHub profile's email goes to the adapter untouched, so `Tom@example.com` from GitHub and `tom@example.com` from registration are two `User` rows for one person. Nothing is broken today — each account works on its own — but this lands squarely in the account-linking work: linking asks "is this the same person?", and a case-sensitive comparison answers no. Deciding it means picking where normalization belongs (a `signIn` callback, the adapter, or a citext/lowercase column plus a backfill), and it should be settled *with* linking rather than before it, since the two answers have to agree.
- **A collection read transfers one row per item in it.** **Decided 2026-09-01: left as it is, deliberately.** `COLLECTION_SELECT` and `SIDEBAR_COLLECTION_SELECT` join every item of every collection they read — two scalars each, no bodies — and `itemCount`, `dominantItemType` and the type breakdown are all derived from those rows in JavaScript. `getSidebarCollections()` runs on **every** dashboard page view, and `getCollections`, `getDashboardCollections`, `getFavoriteCollections` and `getCollectionPageData` do the same on theirs, so an account with five thousand items across its collections moves five thousand rows to render a count and a coloured dot. The clean fix is one grouped aggregate — `COUNT(*)` and `MAX(editedAt)` per `(collection, itemType)`, from which all three values fall out — and Prisma's typed API cannot express it across the many-to-many for a *list* of collections: `groupBy` on `Item` cannot carry `collectionId`, because items have no such column, and `groupBy` on `ItemCollection` cannot reach `item.itemTypeId`. So it needs `$queryRaw`, which would be the first raw SQL in `src/` (`scripts/test-db.ts` has the only existing use). That is the whole trade, and it was declined for now on one ground: the free tier caps an account at fifty items, so every free account is bounded by construction and the unbounded case exists only for Pro. Worth revisiting the moment a real Pro profile is large enough to measure — the single-collection page is separable and *can* be done Prisma-natively with `prisma.item.groupBy`, since one fixed `collectionId` makes `itemTypeId` a valid group key on its own.

- **Read-only monaco has never been touched by a finger.** Small, and listed only so it is not forgotten. Writing on a coarse pointer falls back to a plain textarea, but *reading* keeps monaco, and monaco handles its own touch scrolling — so on a snippet long enough to scroll inside the editor, a drag that starts over the code may scroll the editor and never hand the drawer back. Emulation cannot answer it: the fallback was verified by stubbing `matchMedia`, and real touch chaining is a device behaviour. The editor's viewport-aware ceiling makes it rarer (the editor only scrolls itself on genuinely long content), and the fix if it does bite is one line — let reading fall back too, losing highlighting on phones. **Check it on a real phone against the deployed app**, not before.
- **AI cost controls.** Mostly answered; one half left. Per-user rate limits ship — each of the four actions takes a token from its own bucket in `server/infra/rate-limit.ts`, keyed by user id, so the budget is per person rather than per address — and the failure side is handled too: `server/infra/openai.ts` pins a 30-second timeout and two retries, and every action turns a refusal into a message rather than an unhandled throw. What is still open is *usage accounting*. Rate limits bound the shape of the spend, not its total: nothing records what an account has consumed, so nothing can answer "what has this user cost" or stop someone who stays inside every window from being expensive all month. That needs a counter per user per period, which is a schema question rather than a tuning one.
- **Soft vs hard delete.** Whether deleted items are recoverable (a trash view) or gone immediately — affects schema (`deletedAt`) if you want undo.
- **Data export scope.** Does export include files (ZIP with the actual R2 objects) or just metadata/text (JSON)? The spec implies both formats.
- **Caching strategy.** Redis is now a real dependency, but for *throttling*, not caching — `server/infra/rate-limit.ts` runs five sliding windows on Upstash. Using it as a read cache is still deferred until there is a measured hot path (likely the collections grid and recently-used) rather than added upfront. The instance is already provisioned, so the cost of the decision is now only the invalidation design.
- **Session revocation.** Sessions are JWTs with no version claim, so nothing can invalidate one that is already issued. Changing a password — from `/settings` or a reset link — leaves any session held on another device signed in, which means a compromised password cannot actually be locked out. Account deletion is unaffected: the row is gone, so `getCurrentUser()` throws and every authenticated read fails closed. The fix is a `sessionVersion` (or `passwordChangedAt`) on `User`, carried in the token and compared on each request — but that comparison is a database read per request, which is most of the reason `strategy: "jwt"` was chosen over `"database"` (the edge proxy authorizes without touching Postgres). So this reopens the session-strategy decision rather than being a patch, and is deliberately deferred until the account-linking work settles. **Done 2026-09-02:** `maxAge` is now seven days (`src/auth.ts`), down from thirty, which bounds the exposure without committing to anything. Be precise about what that buys — Auth.js re-issues the token on activity, so seven days is the **idle** window: it closes the abandoned-browser and stolen-laptop cases four times sooner, and does nothing about a session someone is actively using. Only revocation ends that one.

---

## 12. Reference Links

| Resource | URL |
|----------|-----|
| Next.js | https://nextjs.org/docs |
| React | https://react.dev |
| Prisma | https://www.prisma.io/docs |
| Neon | https://neon.tech/docs |
| NextAuth v5 | https://authjs.dev |
| Cloudflare R2 | https://developers.cloudflare.com/r2 |
| Tailwind CSS v4 | https://tailwindcss.com/docs |
| shadcn/ui | https://ui.shadcn.com |
| lucide-react icons | https://lucide.dev |
| OpenAI API | https://platform.openai.com/docs |
| Stripe | https://stripe.com/docs |
