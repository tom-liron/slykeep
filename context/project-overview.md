# DevStash — Project Overview

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

**DevStash** solves this by providing a single, fast, searchable, AI-enhanced hub for everything a developer needs to stash and retrieve.

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
- Import code from a file
- Markdown editor for text types
- File upload for file types (file / image)
- Export data in multiple formats
- Dark mode (default for devs), light mode optional
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
> - `Tag` is global (`name @unique`), which collides across users and pollutes autocomplete. Per-user scoping (`@@unique([userId, name])`) is the better model; deferred to keep the migration path aligned with the course.
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
| **Caching** | Redis | *Maybe* — for caching hot reads |
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
| Search | Basic | Basic |
| AI auto-tagging | ❌ | ✅ |
| AI code explanation | ❌ | ✅ |
| AI prompt optimizer | ❌ | ✅ |
| Export (JSON / ZIP) | ❌ | ✅ |
| Support | — | Priority |

> **During development:** scaffold the Pro gating, but let all users access everything. Flip the gates on before launch.

---

## 8. UI / UX

### General Direction

- Modern, minimal, developer-focused
- Dark mode by default; light mode optional
- Clean typography, generous whitespace
- Subtle borders and shadows
- Syntax highlighting for code blocks
- **References:** Notion, Linear, Raycast

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
- **Drawer (planned):** individual items will open in a fast slide-out drawer for view / edit / create.

Collection recency is based on `updatedAt`. The dominant type is the most common item type in the collection; if counts tie, the type of the most recently updated tied item wins. Empty collections use `defaultTypeId`.

### Type Colors & Icons

Icons are [lucide-react](https://lucide.dev) names.

| Type | Color | Swatch | Icon |
|------|-------|--------|------|
| Snippet | `#3b82f6` (blue) | 🟦 | `Code` |
| Prompt | `#8b5cf6` (purple) | 🟪 | `Sparkles` |
| Command | `#f97316` (orange) | 🟧 | `Terminal` |
| Note | `#fde047` (yellow) | 🟨 | `StickyNote` |
| File | `#6b7280` (gray) | ⬜ | `File` |
| Image | `#ec4899` (pink) | 🟪 | `Image` |
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

The current application implements the authentication routes and flows, the dashboard routes, feature components, runtime configuration, and the server-only, Prisma-backed query layer shown below. Entries marked **(planned)** are target additions for later product phases, not files that already exist.

```
devstash/
├── prisma/
│   ├── schema.prisma            # persisted model; datasource url lives in prisma.config.ts
│   ├── seed.ts                  # seeds the seven system item types, and demo content unless --types-only
│   ├── seed-data.ts             # the demo collections and items, kept out of the seed's logic
│   └── migrations/              # migration history (never edit applied ones)
├── prisma.config.ts             # Prisma 7 CLI config: schema path, migrations, seed, datasource
├── scripts/
│   ├── test-db.ts               # database smoke test (`npm run db:test`)
│   ├── test-email.ts            # sends through Resend and polls the real outcome (`npm run email:test`)
│   └── verify-user.ts           # marks a dev account verified by hand (`npm run user:verify`)
├── public/                      # (planned, when static assets are needed)
├── src/
│   ├── app/
│   │   ├── (auth)/              # signed-out routes, no sidebar
│   │   │   ├── layout.tsx       # centered card shell
│   │   │   ├── sign-in/         # /sign-in — credentials form + GitHub
│   │   │   ├── register/        # /register — account creation
│   │   │   ├── forgot-password/ # /forgot-password — request a reset link
│   │   │   └── reset-password/  # /reset-password — set a new password from a link
│   │   ├── (dashboard)/        # authed app, sidebar layout
│   │   │   ├── layout.tsx       # sidebar + main shell
│   │   │   ├── page.tsx         # dashboard overview (home)
│   │   │   ├── items/
│   │   │   │   └── [slug]/      # /items/snippets, /items/links, ...
│   │   │   ├── collections/
│   │   │   │   └── [id]/
│   │   │   ├── profile/         # account page: identity, usage, password, delete
│   │   │   ├── search/          # (planned)
│   │   │   └── settings/        # (planned) account, billing, export
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/  # Auth.js handler
│   │   │   ├── auth/register/       # account creation (needs 400 vs 409)
│   │   │   ├── auth/verify-email/   # confirm a link, or resend one
│   │   │   ├── auth/forgot-password/# request a reset link
│   │   │   ├── auth/reset-password/ # spend a reset token
│   │   │   ├── auth/stale-session/  # clear a cookie whose account no longer exists
│   │   │   ├── items/[id]/      # item detail the drawer fetches (404 vs retryable)
│   │   │   ├── collections/     # (planned)
│   │   │   ├── upload/          # stores one file/image object in R2, returns its key
│   │   │   ├── files/[id]/      # streams an item's object back, authorized per request
│   │   │   ├── ai/              # (planned) tag, summarize, explain, optimize
│   │   │   ├── export/          # (planned) JSON / ZIP
│   │   │   └── stripe/          # (planned) checkout + webhook
│   │   ├── layout.tsx           # root shell and default dark theme
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                  # shared UI primitives and presentational components
│   │   ├── auth/                # sign-in, register, reset, and verification forms
│   │   ├── items/               # item card, list, detail drawer, edit form, create dialog, upload
│   │   ├── collections/         # collection card and page composition
│   │   ├── dashboard/           # stat card
│   │   ├── profile/             # change-password form, delete-account dialog
│   │   └── layout/              # sidebar, topbar, command palette, mobile drawer, account menu
│   ├── generated/prisma-client/ # Prisma Client, compiled from prisma/schema.prisma.
│   │                            # Build output: gitignored, never edited, rewritten by
│   │                            # `prisma generate` (runs on every `npm install`).
│   │                            # Named `prisma-client` so it is not mistaken for /prisma.
│   ├── auth.config.ts           # edge-safe half: providers + pages, no adapter
│   ├── auth.ts                  # node half: adapter, JWT callbacks, real authorize
│   ├── proxy.ts                 # deny-by-default route protection (edge)
│   ├── lib/
│   │   ├── prisma.ts            # singleton Prisma client (PrismaPg adapter)
│   │   ├── auth-schemas.ts      # Zod contracts for sign-in and registration
│   │   ├── auth-errors.ts       # client-safe messages for Auth.js `error` codes
│   │   ├── auth-redirects.ts    # signed-out route sets + callback-URL validation
│   │   ├── rate-limit.ts        # sliding windows on the auth entry points; `server-only`
│   │   ├── email.ts             # Resend client, link building, transactional templates
│   │   ├── item-schemas.ts      # Zod contracts for item writes, and what each type owns
│   │   ├── limits.ts            # item-type entitlement policy
│   │   ├── format.ts            # dates and file sizes, formatted for display
│   │   ├── clipboard.ts         # the clipboard write and its two toasts, for every copy control
│   │   ├── code-language.ts     # free-text `Item.language` → a Monaco language id
│   │   ├── fuzzy-search.ts      # the command palette's match and ranking rule
│   │   ├── utils.ts             # `cn` class merging
│   │   ├── r2.ts                # Cloudflare R2 client, object keys, put/get/delete
│   │   ├── file-constraints.ts  # upload size/extension/MIME rules, shared with the client
│   │   ├── file-preview.ts      # which viewer a file opens in, and what may be served inline
│   │   ├── openai.ts            # (planned) AI client + prompt helpers
│   │   └── stripe.ts            # (planned) Stripe client
│   ├── actions/                 # Server Actions for mutations
│   │   ├── auth.ts              # sign-in / sign-out
│   │   ├── account.ts           # change password, delete account
│   │   └── items.ts             # create, update, and delete an item
│   ├── server/                  # server-only queries, repositories, and view-model preparation
│   │   ├── items.ts             # item reads + item-type pages
│   │   ├── collections.ts       # collection reads
│   │   ├── item-types.ts        # item types, per-type counts, sidebar nav
│   │   ├── current-user.ts      # signed-in user resolution from the session
│   │   ├── profile.ts           # account page read: identity, usage, hasPassword
│   │   ├── passwords.ts         # the one bcrypt cost factor and the decoy hash pinned to it
│   │   ├── verification.ts      # issue, look up, and spend verification/reset tokens
│   │   ├── token-identifiers.ts # the identifier prefix that namespaces a token by purpose
│   │   ├── view-models.ts       # persistence-independent view-model builders
│   │   └── search.ts            # the command palette's prefetch: items + collections
│   ├── hooks/
│   │   └── use-file-upload.ts   # the XHR upload behind the file field, and its progress
│   ├── types/
│   │   ├── item-type.ts         # item-type contracts
│   │   ├── view-models.ts       # persistence-independent UI models
│   │   ├── auth.ts              # auth Server Action result shape
│   │   ├── account.ts           # account Server Action result shape
│   │   └── next-auth.d.ts       # session/JWT augmentation carrying `user.id`
│   └── config/
│       ├── access.ts            # temporary feature-entitlement configuration
│       ├── dashboard.ts         # dashboard presentation values
│       ├── editor.ts            # the surface and height bounds both content editors share
│       └── item-type-catalog.ts # built-in item types: colors, icons, routes
├── .env                         # secrets (gitignored)
├── .env.example                 # documented placeholders, committed
├── vitest.config.ts             # unit tests; tests sit beside the module as `*.test.ts`
└── package.json
```

A few deliberate choices worth noting: route groups `(auth)` and `(dashboard)` keep the signed-out and signed-in shells separate without affecting URLs — which is exactly why the sign-in page is `/sign-in` and the dashboard is `/`, never `/dashboard`. `types/` contains compile-time contracts, while `config/` contains runtime values that satisfy those contracts. A single `config/item-type-catalog.ts` is the source of truth for built-in item type colors, icons, and routes. The `server/` directory owns read-side persistence access and prepares persistence-independent view models; `actions/` owns write-side Server Actions. Reads go through Prisma end to end; the earlier mock query layer has been fully retired.

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

**Phase 2 — Core CRUD (next)**
- Create / read / update / delete items via the quick-access drawer
- Markdown editor for text types, syntax highlighting for code
- Collections: create, color-coding logic, add/remove items, many-to-many
- Favorites, pinning, recently used

**Phase 3 — Search & Polish**
- ~~Search across tags, titles, types~~ — the ⌘K command palette, matching client-side over
  prefetched summaries. Item **content** is deliberately not searched: list queries never read the
  body (§5), so full-content search needs a server-side query rather than a wider prefetch
- Toasts, loading skeletons, hover states, transitions
- Mobile responsiveness (sidebar → drawer)

**Phase 4 — Files (Pro scaffolding)**
- Cloudflare R2 uploads (presigned URLs) for file/image types
- Import code from a file
- Export data (JSON / ZIP)

**Phase 5 — AI (Pro)**
- OpenAI `gpt-5-nano` integration: auto-tagging, summaries, explain-this-code, prompt optimizer

**Phase 6 — Monetization**
- Stripe checkout + customer portal + webhook
- Flip on free-tier gates (50 items / 3 collections / no files / no AI)

**Phase 7 — Launch prep**
- Custom item types
- Priority support path, error monitoring, analytics

---

## 11. Open Questions & Things to Decide

Worth nailing down before or early in the build, so they don't force a rewrite later:

- **Search depth, free vs Pro.** The spec lists "Basic search" for free and the same search engine elsewhere. Decide what actually differs — e.g. free gets title/tag search, Pro gets full-content or AI-semantic search — or drop the distinction.
- **Tag scoping.** Tags are global in the current model. Scope them per-user with `@@unique([userId, name])` to avoid cross-user collisions and noisy autocomplete.
- **Free-tier limit enforcement.** Decide where limits are checked (server-side, in the data layer) and what the UX is when a user hits the cap — upgrade prompt vs hard block.
- **File handling.** Max file size, allowed MIME types, and whether deleting an item also deletes the R2 object (orphan cleanup).
- **R2 objects outlive a deleted account.** `deleteAccount()` deletes the `User` row and Postgres cascades every item with it, but `deleteObject` is only ever called by `deleteItem` — so the bytes stay in the bucket with nothing left in the database pointing at them. This is the same orphan the item-delete path accepts deliberately, except unbounded and unrecoverable: after the cascade there is no row left to read a key from, so a later sweep has to list the bucket by key prefix (`users/<id>/…`) rather than query for what to remove. Harmless while the only accounts are test ones; it becomes a retention promise the moment real users can delete an account, since "delete my account" then does not delete their files. Decide before launch between deleting the objects up front (read the keys, delete the row, then delete the bytes — accepting that a crash between the two leaves the same orphans) and a scheduled prefix sweep.
- **OAuth emails are not normalized, credentials emails are.** `auth-schemas.ts` lowercases and trims every address that arrives through registration or sign-in; the GitHub profile's email goes to the adapter untouched, so `Tom@example.com` from GitHub and `tom@example.com` from registration are two `User` rows for one person. Nothing is broken today — each account works on its own — but this lands squarely in the account-linking work: linking asks "is this the same person?", and a case-sensitive comparison answers no. Deciding it means picking where normalization belongs (a `signIn` callback, the adapter, or a citext/lowercase column plus a backfill), and it should be settled *with* linking rather than before it, since the two answers have to agree.
- **Collection recency is creation order in practice.** §8 says recency is based on `updatedAt`, and both the dashboard's recent collections and the sidebar's recent list do order by it — but nothing ever moves that column. `createCollection()`, `updateCollection()`, and `deleteCollection()` are the only writes to the `collections` table in the codebase, and only the rename moves `updatedAt` — there is still no favourite toggle, and adding or removing an item writes `item_collections` rows through a nested write on the **Item**, which leaves the collection row untouched. So `updatedAt` equals `createdAt` for every collection nobody has renamed, "recent" means "newest", and the one thing that does move the column is a metadata edit rather than activity — which is the reading this is about. The intended reading is last *activity* — item added, removed, or edited — which needs no schema change: touch `updatedAt` on the affected collections from the three item write paths, taking the union of old and new membership on an edit (the collection an item left changed as much as the one it joined) and reading membership before the delete, since the join rows cascade. Deriving it at read time instead — the greatest of the collection's own `updatedAt`, its items', and `ItemCollection.addedAt` — was considered and rejected: it puts a joined aggregate no index can serve in the `ORDER BY` of two queries on every page, to save one `UPDATE` on a path that is already writing. Last *visited* is a third option and a more expensive one, needing a new column and a write on every page view; note that the products it imitates sort by last message, not by opening a conversation. Belongs with the Phase 2 "recently used" work.
- **AI cost controls.** Rate limits / usage caps per Pro user, and graceful handling when the OpenAI call fails or times out.
- **Soft vs hard delete.** Whether deleted items are recoverable (a trash view) or gone immediately — affects schema (`deletedAt`) if you want undo.
- **Data export scope.** Does export include files (ZIP with the actual R2 objects) or just metadata/text (JSON)? The spec implies both formats.
- **Caching strategy.** Redis is marked "maybe" — defer until there's a measured hot path (likely the collections grid and recently-used) rather than adding it upfront.
- **Session revocation.** Sessions are JWTs with no version claim, so nothing can invalidate one that is already issued. Changing a password — from `/profile` or a reset link — leaves any session held on another device signed in, which means a compromised password cannot actually be locked out. Account deletion is unaffected: the row is gone, so `getCurrentUser()` throws and every authenticated read fails closed. The fix is a `sessionVersion` (or `passwordChangedAt`) on `User`, carried in the token and compared on each request — but that comparison is a database read per request, which is most of the reason `strategy: "jwt"` was chosen over `"database"` (the edge proxy authorizes without touching Postgres). So this reopens the session-strategy decision rather than being a patch, and is deliberately deferred until the account-linking work settles. Lowering the JWT `maxAge` from the 30-day default bounds the exposure in the meantime without committing to anything.

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
