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
- **Drawer:** an item opens in a fast slide-out drawer for view / edit / create — `ItemDrawer` plus `ItemDrawerToolbar`, which carries Favorite, Pin, Copy, Download and Edit on one row over whatever page you were already on.

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
│   ├── check-doc-links.ts       # verifies every `{@link}` in `src/` resolves (`npm run docs:links`)
│   ├── test-db.ts               # database smoke test (`npm run db:test`)
│   ├── test-email.ts            # sends through Resend and polls the real outcome (`npm run email:test`)
│   ├── verify-user.ts           # marks a dev account verified by hand (`npm run user:verify`)
│   ├── sync-monaco.ts           # copies the pinned monaco build into `public/` (`predev`,
│   │                            # `prebuild`), so the editor is served from this origin
│   ├── sweep-unverified.ts      # deletes unverified accounts past their TTL by hand
│   │                            # (`npm run users:sweep`); the cron route calls the same function
│   └── clear-users.ts           # deletes every account but the demo user; `npm run db:reset`
│                                # runs it and reseeds. Host-confirmed, never production
├── public/                      # the monaco build, copied out of node_modules by
│                                # `npm run monaco:sync`; gitignored, never edited
├── docs/                        # plan and architecture records, each written before its subsystem was
│                                # built and not revised after; every committed file carries a "not
│                                # maintained" banner, and where one disagrees with `src/`, code wins
│   └── audit-results/           # point-in-time output from the review agents in `.claude/agents/`
├── prototypes/
│   └── homepage/                # marketing homepage mockup: plain HTML/CSS/JS, no build step,
│                                # opened directly in a browser. Outside the Next.js app entirely.
├── src/
│   ├── app/
│   │   ├── (marketing)/         # signed-out shell: no app chrome, its own scroll container,
│   │   │                        # and the item-type palette handed down as CSS variables
│   │   │   └── welcome/         # /welcome — the landing page, served without a session
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
│   │   │   ├── favorites/       # /favorites — starred items and collections, one dense list
│   │   │   ├── profile/         # account page, read-only: identity and usage
│   │   │   ├── upgrade/         # the plan comparison for a signed-in free account; Pro is
│   │   │   │                    # redirected to /settings#billing
│   │   │   ├── search/          # (planned)
│   │   │   └── settings/        # billing panel, then account actions: change password,
│   │   │                        # delete account (export lands here later)
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/  # Auth.js handler
│   │   │   ├── auth/register/       # account creation (needs 400 vs 409)
│   │   │   ├── auth/verify-email/   # confirm a link, or resend one
│   │   │   ├── auth/forgot-password/# request a reset link
│   │   │   ├── auth/reset-password/ # spend a reset token
│   │   │   ├── auth/stale-session/  # clear a cookie whose account no longer exists
│   │   │   ├── items/[id]/      # item detail the drawer fetches (404 vs retryable)
│   │   │   ├── collections/     # collection creation from the forms' picker
│   │   │   ├── upload/          # stores one file/image object in R2, returns its key
│   │   │   ├── files/[id]/      # streams an item's object back, authorized per request
│   │   │   │                    # (no `ai/` route: the four AI features are Server Actions in
│   │   │   │                    # `actions/ai.ts`, since no caller needs an HTTP status)
│   │   │   ├── export/          # (planned) JSON / ZIP
│   │   │   ├── cron/sweep-unverified/ # nightly Vercel Cron: deletes abandoned registrations.
│   │   │   │                    # Refuses with 503 unless `CRON_SECRET` is set
│   │   │   └── webhook/stripe/  # Stripe's subscription events; the one path excluded from
│   │   │                        # the proxy, authenticated by its stripe-signature header
│   │   ├── layout.tsx           # root shell and default dark theme
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                  # shared UI primitives and presentational components (incl. the account Panel)
│   │   ├── auth/                # sign-in, register, reset, and verification forms
│   │   ├── billing/             # the /upgrade plan cards and their cycle switch
│   │   ├── items/               # item card, row, list, detail drawer, edit form, create dialog, upload
│   │   ├── collections/         # collection card, row, actions, and page composition
│   │   ├── dashboard/           # stat card
│   │   ├── favorites/           # the starred lists and their client-side sort control
│   │   ├── marketing/           # the landing page's sections: hero, features, AI, pricing, CTA
│   │   ├── pricing/             # the plan card and cycle switch, shared by the landing page
│   │   │                        # and /upgrade so the two cannot drift apart
│   │   ├── settings/            # billing rows, change-password dialog, delete-account dialog
│   │   └── layout/              # sidebar, topbar, command palette, mobile drawer, account menu
│   ├── generated/prisma-client/ # Prisma Client, compiled from prisma/schema.prisma.
│   │                            # Build output: gitignored, never edited, rewritten by
│   │                            # `prisma generate` (runs on every `npm install`).
│   │                            # Named `prisma-client` so it is not mistaken for /prisma.
│   ├── auth.config.ts           # edge-safe half: providers + pages, no adapter
│   ├── auth.ts                  # node half: adapter, JWT callbacks, real authorize
│   ├── proxy.ts                 # deny-by-default route protection (edge)
│   ├── lib/                     # client-safe shared modules: importable from anywhere, server or client
│   │   ├── auth-schemas.ts      # Zod contracts for sign-in and registration
│   │   ├── auth-errors.ts       # client-safe messages for Auth.js `error` codes
│   │   ├── auth-redirects.ts    # signed-out route sets + callback-URL validation
│   │   ├── item-schemas.ts      # Zod contracts for item writes, and what each type owns
│   │   ├── collection-schemas.ts# the same, for collection writes
│   │   ├── field-errors.ts      # one Zod parse → the toast's sentence and the inputs' messages
│   │   ├── limits.ts            # entitlement policy: item types, and the free item/collection caps
│   │   ├── format.ts            # dates and file sizes, formatted for display
│   │   ├── clipboard.ts         # the clipboard write and its two toasts, for every copy control
│   │   ├── code-language.ts     # free-text `Item.language` → a Monaco language id
│   │   ├── favorites-sort.ts    # how `/favorites` orders its two lists, client-side
│   │   ├── fuzzy-search.ts      # the command palette's match and ranking rule
│   │   ├── pagination.ts        # `?page=` parsing, page clamping, skip, and the page-number window
│   │   ├── editor-metrics.ts    # the two editor numbers that are not simply the stored preference
│   │   ├── type-color-vars.ts   # the item-type palette as CSS variables, for the surfaces
│   │   │                        # designed out of it (the landing page and /upgrade)
│   │   ├── utils.ts             # `cn` class merging
│   │   ├── file-constraints.ts  # upload size/extension/MIME rules, shared with the client
│   │   ├── file-preview.ts      # which viewer a file opens in, and what may be served inline
│   │   ├── ai-text.ts           # what an item draft contributes to a prompt, and its bounds
│   │   ├── ai-tags.ts           # the auto-tag prompt and the parsing of what comes back
│   │   ├── ai-description.ts    # the same, for a generated description
│   │   ├── ai-explain.ts        # the same, for "explain this code"
│   │   ├── ai-optimize.ts       # the same, for the prompt optimizer
│   │   ├── markdown-plugins.ts  # the remark/rehype set every markdown surface renders with
│   │   └── editor-preferences.ts# the editor settings' defaults and their bounds
│   ├── actions/                 # Server Actions for mutations
│   │   ├── ai.ts                # the four Pro AI actions: tag, describe, explain, optimize
│   │   ├── auth.ts              # sign-in / sign-out
│   │   ├── account.ts           # change password, delete account (refused while billing)
│   │   ├── billing.ts           # open Stripe checkout, open the customer portal
│   │   ├── collections.ts       # create, rename, delete, favorite a collection
│   │   ├── editor-preferences.ts# persist the editor settings
│   │   └── items.ts             # create, update, and delete an item
│   ├── server/                  # everything server-only: queries, repositories, view-model
│   │                            # preparation, and the integration clients in `infra/`
│   │   ├── billing.ts           # Stripe customer, the webhook's entitlement sync, the panel's
│   │   │                        # summary, and the two helpers account deletion needs. Deletion
│   │   │                        # cancels and detaches the card; it never deletes the customer
│   │   ├── items.ts             # item reads + item-type pages
│   │   ├── collections.ts       # collection reads
│   │   ├── item-types.ts        # item types, per-type counts, sidebar nav
│   │   ├── current-user.ts      # signed-in user resolution from the session
│   │   ├── profile.ts           # profile read: identity + usage; settings read: hasPassword + totals
│   │   ├── passwords.ts         # the one bcrypt cost factor and the decoy hash pinned to it
│   │   ├── prisma-errors.ts     # the Prisma error codes the write paths translate into messages
│   │   ├── verification.ts      # issue, look up, and spend verification/reset tokens
│   │   ├── token-identifiers.ts # the identifier prefix that namespaces a token by purpose
│   │   ├── unverified.ts        # the rule for which abandoned registrations the sweep deletes
│   │   ├── view-models.ts       # persistence-independent view-model builders
│   │   ├── search.ts            # the command palette's prefetch: items + collections
│   │   └── infra/               # the integration clients, all `server-only`: the half of
│   │                            # `server/` that talks to something outside the process
│   │       ├── prisma.ts        # singleton Prisma client (PrismaPg adapter), and the
│   │       │                    # guard keeping a local run off the production database
│   │       ├── stripe.ts        # lazy Stripe client, pinned API version, return origin
│   │       ├── r2.ts            # Cloudflare R2 client, object keys, put/get/delete
│   │       ├── openai.ts        # lazy OpenAI client, model id, shared call wrapper
│   │       ├── email.ts         # Resend client, link building, transactional templates
│   │       ├── rate-limit.ts    # sliding windows on the auth, upload, billing and AI
│   │       │                    # entry points
│   │       └── app-origin.ts    # this deployment's own origin, for email links and
│   │                            # Stripe return URLs; throws rather than defaulting
│   ├── hooks/
│   │   ├── use-file-upload.ts   # the XHR upload behind the file field, and its progress
│   │   ├── use-file-text.ts     # a stored file's own bytes, for the formats rendered inline
│   │   ├── use-item-detail.ts   # the parts of an item a list summary cannot carry
│   │   ├── use-media-query.ts   # a media query as state, where the choice is which element exists
│   │   ├── use-coarse-pointer.ts# whether this is a touch pointer, for the editor fallback
│   │   └── use-collection-options.ts # the collections a form's picker offers
│   ├── types/
│   │   ├── item-type.ts         # item-type contracts
│   │   ├── item.ts              # item Server Action result shapes
│   │   ├── collection.ts        # collection Server Action result shapes
│   │   ├── editor.ts            # editor preference contracts
│   │   ├── ai.ts                # the AI actions' draft input and their result shapes
│   │   ├── view-models.ts       # persistence-independent UI models
│   │   ├── auth.ts              # auth Server Action result shape
│   │   ├── account.ts           # account Server Action result shape
│   │   ├── billing.ts           # billing Server Action result shape (failure arm only)
│   │   └── next-auth.d.ts       # session/JWT augmentation carrying `user.id`
│   └── config/
│       ├── access.ts            # temporary feature-entitlement configuration
│       ├── billing.ts           # Stripe price ids by cycle, and which statuses entitle Pro
│       ├── dashboard.ts         # dashboard presentation values
│       ├── editor.ts            # the surface and height bounds both content editors share
│       ├── item-placeholders.ts  # the title placeholder each item type's form shows
│       ├── item-type-catalog.ts # built-in item types: colors, icons, routes
│       ├── marketing.ts         # the landing page's copy, and the two pricing plans
│       └── pagination.ts        # how many rows one page of a listing renders
├── .env                         # secrets (gitignored)
├── .env.example                 # documented placeholders, committed
├── vercel.json                  # the nightly cron schedule for `/api/cron/sweep-unverified`
├── vitest.config.ts             # unit tests; tests sit beside the module as `*.test.ts`.
│                                # Excludes `*.integration.test.ts`, so `npm test` stays offline
├── vitest.integration.config.ts # tests that talk to real services (`npm run billing:test`,
│                                # `npm run r2:test`): credentials, seconds not milliseconds, a
│                                # real Stripe account and a real bucket. Each script names its
│                                # own file, so one does not drag in the other's cost
├── vitest.server-only.ts        # stubs the `server-only` import so server modules are testable
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
- ~~Toasts, hover states, transitions~~ — sonner with `richColors`, and the micro-interactions in §8.
  Loading *skeletons* are the exception: there are no route-level `loading.tsx` files, so navigation
  waits on the server component rather than showing a placeholder
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
- **A domain, and `EMAIL_FROM` on it.** Decided, not open: everything email-shaped waits for a real
  domain and is fixed together at that point. Until then `EMAIL_FROM` is unset, so `server/infra/email.ts`
  falls back to `onboarding@resend.dev`, which Resend delivers **only to the account owner's own
  address** — every other recipient is refused with a 403. In development that is what
  `npm run user:verify` exists to work around. In production it means registration completes and
  then tells the user their confirmation email could not be sent, for everyone except the owner, so
  nobody else can sign in. One variable on a verified domain is the whole fix and nothing in the
  code changes with it. Deploying to real users before this is done is the thing to avoid.

---

## 11. Open Questions & Things to Decide

Worth nailing down before or early in the build, so they don't force a rewrite later:

- ~~**Search depth, free vs Pro.**~~ **Decided 2026-09-02: the distinction is dropped.** §7 listed `Basic | Basic`, which compared nothing, while the shipped pricing card had already settled it — Free reads "Instant ⌘K search" and Pro reads "Everything in Free, plus". One search for everyone. §7 now says so. What remains is a *depth* question with no tier in it: the palette matches client-side over prefetched summaries and deliberately never reads item bodies, because list queries do not select content (§5). Full-content search therefore needs a server-side query, not a wider prefetch — and if it is ever built, it is built for both tiers.
- ~~**Tag scoping.**~~ **Resolved 2026-09-02.** Tags were global rows keyed by `name @unique`, so two users who both wrote `react` shared one row — which made "this user's tags" a question the database could not answer, and therefore made tag autocomplete unbuildable without leaking the names other accounts had coined. `Tag` now carries `userId` and `normalized`, with `@@unique([userId, normalized])`; see §5. The migration does a full per-user split and a case collapse, both proven against manufactured data since no environment actually held either case. **What this unblocks, and what is still open:** autocomplete (suggest from the user's own vocabulary, which is the real defence against `react`/`reactjs` drift — and it should also feed the AI tagger, which currently invents fresh spellings because the prompt never sees the tags the account already uses) and tag filtering (the badges on `ItemCard` are inert; nothing turns a tag into a query). Neither is on the roadmap yet. A **merge/rename** control is the third piece, and is cheap now that tags have an owner.
- ~~**Free-tier limit enforcement.**~~ **Decided 2026-08-17.** Limits are checked at the *write boundary* — the Server Action, not the data layer — which is the same division `contentType` follows: the UI may show the cap, the action is the authority. Hitting the cap is a **hard block** with an upgrade-flavoured error toast, because the pricing page already promises "Up to 50 items" and a 51st that succeeds turns the number into decoration. The rules themselves are pure functions in `src/lib/limits.ts` beside `canAccessItemType`, taking the count rather than querying, so they stay unit-testable without a database. See `context/features/stripe-phase-1-spec.md` (the rules) and `stripe-phase-2-spec.md` (the call sites). `ENFORCE_PRO_LIMITS` is now `true`, so all of this refuses for real. One thing stays open and is noted there: the accepted race where two concurrent creates both read 49.
- **File handling.** Max file size, allowed MIME types, and whether deleting an item also deletes the R2 object (orphan cleanup).
- ~~**R2 objects outlive a deleted account.**~~ **Resolved 2026-09-01.** `deleteAccount()` deleted the `User` row and Postgres cascaded every item with it, but `deleteObject` was only ever called by `deleteItem` — so the bytes stayed in the bucket with nothing left in the database pointing at them, and "delete my account" did not delete the account's files. `deleteUserObjects(userId)` in `src/server/infra/r2.ts` now lists and deletes the `users/<id>/` prefix a page at a time, and `deleteAccount` calls it. The prefix rather than `Item.fileKey` is the point: the cascade destroys every row that could hold a key, while `buildObjectKey` is the only thing that mints one and `isOwnedKey` already treats the prefix as proof of ownership — so the prefix is the authority on what belongs to the account, and it also catches the orphans `deleteItem` leaves behind when its own object delete fails. **Ordering:** the sweep runs *after* the row delete, unlike the Stripe cleanup which must run before it, because sweeping first would mean a failed `user.delete` had already destroyed a live account's files — the same trade `deleteItem` makes at item scale. Best-effort and logged either way. **Still open, and deliberately:** the crash window between the two is now bounded rather than unbounded, and closing it needs a `/api/cron/sweep-orphaned-objects` route in the pattern `/api/cron/sweep-unverified` established — the mechanism it would call already exists.
- **OAuth emails are not normalized, credentials emails are.** `auth-schemas.ts` lowercases and trims every address that arrives through registration or sign-in; the GitHub profile's email goes to the adapter untouched, so `Tom@example.com` from GitHub and `tom@example.com` from registration are two `User` rows for one person. Nothing is broken today — each account works on its own — but this lands squarely in the account-linking work: linking asks "is this the same person?", and a case-sensitive comparison answers no. Deciding it means picking where normalization belongs (a `signIn` callback, the adapter, or a citext/lowercase column plus a backfill), and it should be settled *with* linking rather than before it, since the two answers have to agree.
- ~~**An unverified account holds its email address forever.**~~ **Resolved 2026-09-01.** Registration created the `User` row before the verification email was sent and nothing ever removed it, so a typo at signup — `tomm@` for `tom@` — locked that address out of the product for good, and the person it belonged to hit the 409 in `api/auth/register` with no route forward. A nightly Vercel Cron now calls `/api/cron/sweep-unverified`, which deletes `emailVerified: null` rows older than `UNVERIFIED_ACCOUNT_TTL_DAYS` (seven) — the number GitLab's own issue proposes as a default for exactly this case. The rule lives in `src/server/unverified.ts`; `npm run users:sweep` runs the same function by hand. Three of its six `where` clauses are guards rather than the rule, and the load-bearing one is `accounts: { none: {} }`: a GitHub sign-up is stamped verified by the `linkAccount` event in `src/auth.ts`, which is a *second* write after the `User` and `Account` rows exist, so a transient failure there would leave a real GitHub account looking exactly like an abandoned registration. **Re-registration takeover** — letting a fresh signup replace an unverified row — is the half deliberately *not* built: it answers the person who spotted the typo immediately, which a sweep cannot, but it widens an existence disclosure and costs nothing to defer while there are no real users. **Deployment dependency:** the route refuses to run unless `CRON_SECRET` is set in Vercel.
- ~~**Collection recency is creation order in practice.**~~ **Resolved 2026-09-02.** §8 said recency was `updatedAt` and both the dashboard's recent collections and the sidebar's recent list did order by it — but nothing ever moved the column. Membership is written as a nested write on the **Item**, so `item_collections` changed while the `collections` row was never in the statement; `updatedAt` therefore equalled `createdAt` for every collection nobody had renamed, "recent" meant "newest", and the one thing that did move it was a rename, which is metadata rather than activity. `touchCollections()` in `src/actions/items.ts` now moves it from all three item write paths. The two halves worth knowing: an **edit takes the union of old and new membership**, because a collection the item left changed as much as the one it joined — and when a payload carries no `collectionIds` at all, the collections already holding the item are still touched, since editing an item is activity for wherever it is filed (that is the common case, and the one a naive implementation misses). **Delete reads membership before the row**, since the join rows cascade. The read-time alternative — the greatest of the collection's own `updatedAt`, its items' and `ItemCollection.addedAt` — was rejected: it puts a joined aggregate no index can serve into the `ORDER BY` of two queries on every dashboard page view, to save one `UPDATE` on a path already writing. Last *visited* was rejected too; it needs a new column and a write on every page view, and the products this imitates sort by last message, not by opening a conversation. The touch is best-effort and logged: the item write has already succeeded and been reported, so a failure costs a sidebar ordering rather than the user's work.
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
