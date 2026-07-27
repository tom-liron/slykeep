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

```prisma
// ----- User (extends NextAuth) -----
model User {
  id                   String       @id @default(cuid())
  email                String       @unique
  emailVerified        DateTime?
  name                 String?
  image                String?
  password             String?      // null for OAuth-only accounts

  // Monetization
  isPro                Boolean      @default(false)
  stripeCustomerId     String?      @unique
  stripeSubscriptionId String?      @unique

  // Relations
  items                Item[]
  collections          Collection[]
  itemTypes            ItemType[]   // custom types; null owner = system type
  accounts             Account[]
  sessions             Session[]

  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt

  @@map("users")
}

// ----- NextAuth -----
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

// ----- Item -----
enum ContentType {
  TEXT
  FILE
  URL
}

model Item {
  id          String           @id @default(cuid())
  title       String
  contentType ContentType      // discriminates the three fields below
  content     String?          // TEXT items
  url         String?          // URL items
  fileUrl     String?          // FILE items — Cloudflare R2 object
  fileName    String?          // FILE items — original filename
  fileSize    Int?             // FILE items — bytes
  description String?
  language    String?          // optional, for code highlighting
  isFavorite  Boolean          @default(false)
  isPinned    Boolean          @default(false)

  // Relations
  userId      String
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  itemTypeId  String
  itemType    ItemType         @relation(fields: [itemTypeId], references: [id])
  tags        Tag[]            @relation("ItemTags")
  collections ItemCollection[] // many-to-many via join table

  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  @@index([userId])
  @@index([itemTypeId])
  @@index([createdAt])
  @@map("items")
}

// ----- ItemType -----
model ItemType {
  id       String  @id @default(cuid())
  name     String  // natural key: lowercase singular — "snippet", "prompt", ...
  icon     String  // one of the application-supported Lucide icon names
  color    String  // hex
  isSystem Boolean @default(false)

  // Relations — user is null for system types
  userId                String?
  user                  User?        @relation(fields: [userId], references: [id], onDelete: Cascade)
  items                 Item[]
  defaultForCollections Collection[]

  @@unique([name, userId])                                   // scopes a custom type to its owner
  @@unique([name], where: { userId: null })                  // ...and this constrains system types
  @@index([userId])
  @@map("item_types")
}

// ----- Collection -----
model Collection {
  id            String           @id @default(cuid())
  name          String           // "React Hooks", "Prototype Prompts", ...
  description   String?
  isFavorite    Boolean          @default(false)

  // Relations
  userId        String
  user          User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  defaultTypeId String?          // default type for new, empty collections
  defaultType   ItemType?        @relation(fields: [defaultTypeId], references: [id])
  items         ItemCollection[] // many-to-many via join table

  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  @@index([userId])
  @@map("collections")
}

// ----- ItemCollection (join table) -----
model ItemCollection {
  itemId       String
  collectionId String
  addedAt      DateTime   @default(now()) // when the item was added to the collection

  item         Item       @relation(fields: [itemId], references: [id], onDelete: Cascade)
  collection   Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)

  @@id([itemId, collectionId])
  @@map("item_collections")
}

// ----- Tag -----
model Tag {
  id    String @id @default(cuid())
  name  String @unique
  items Item[] @relation("ItemTags")

  @@map("tags")
}
```

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

The current application implements the dashboard routes, feature components, runtime configuration, and the server-only, Prisma-backed query layer shown below. Entries marked **(planned)** are target additions for later product phases, not files that already exist.

```
devstash/
├── prisma/
│   ├── schema.prisma            # persisted model; datasource url lives in prisma.config.ts
│   ├── seed.ts                  # seeds the seven system item types from the catalog
│   └── migrations/              # migration history (never edit applied ones)
├── prisma.config.ts             # Prisma 7 CLI config: schema path, migrations, seed, datasource
├── scripts/
│   └── test-db.ts               # database smoke test (`npm run db:test`)
├── public/                      # (planned, when static assets are needed)
├── src/
│   ├── app/
│   │   ├── (auth)/              # signed-out routes, no sidebar
│   │   │   ├── layout.tsx       # centered card shell
│   │   │   ├── sign-in/         # /sign-in — credentials form + GitHub
│   │   │   └── register/        # /register — account creation
│   │   ├── (dashboard)/        # authed app, sidebar layout
│   │   │   ├── layout.tsx       # sidebar + main shell
│   │   │   ├── page.tsx         # dashboard overview (home)
│   │   │   ├── items/
│   │   │   │   └── [slug]/      # /items/snippets, /items/links, ...
│   │   │   ├── collections/
│   │   │   │   └── [id]/
│   │   │   ├── profile/         # read-only account summary
│   │   │   ├── search/          # (planned)
│   │   │   └── settings/        # (planned) account, billing, export
│   │   ├── api/                 # (planned)
│   │   │   ├── auth/[...nextauth]/
│   │   │   ├── items/
│   │   │   ├── collections/
│   │   │   ├── upload/          # R2 presigned URLs / uploads
│   │   │   ├── ai/              # tag, summarize, explain, optimize
│   │   │   ├── export/          # JSON / ZIP
│   │   │   └── stripe/          # checkout + webhook
│   │   ├── layout.tsx           # root shell and default dark theme
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                  # shared UI primitives and presentational components
│   │   ├── items/               # item card; drawer/editor planned
│   │   ├── collections/         # collection card and page composition
│   │   └── layout/              # sidebar, topbar, mobile drawer
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
│   │   ├── r2.ts                # (planned) Cloudflare R2 client
│   │   ├── openai.ts            # (planned) AI client + prompt helpers
│   │   ├── stripe.ts            # (planned) Stripe client
│   │   └── limits.ts            # item-type entitlement policy
│   ├── actions/                 # Server Actions for mutations
│   │   └── auth.ts              # sign-in / sign-out
│   ├── server/                  # server-only queries, repositories, and view-model preparation
│   │   ├── items.ts             # item reads + item-type pages
│   │   ├── collections.ts       # collection reads
│   │   ├── item-types.ts        # item types + sidebar nav
│   │   ├── current-user.ts      # signed-in user resolution (demo user until auth lands)
│   │   ├── view-models.ts       # persistence-independent view-model builders
│   │   └── search.ts            # (planned)
│   ├── hooks/                   # (planned)
│   ├── types/
│   │   ├── item-type.ts         # item-type contracts
│   │   └── view-models.ts       # persistence-independent UI models
│   └── config/
│       ├── access.ts            # temporary feature-entitlement configuration
│       ├── dashboard.ts         # dashboard presentation values
│       └── item-type-catalog.ts # built-in item types: colors, icons, routes
├── .env                         # secrets (gitignored)
├── .env.example                 # documented placeholders, committed
└── package.json
```

A few deliberate choices worth noting: route groups `(auth)` and `(dashboard)` keep the signed-out and signed-in shells separate without affecting URLs — which is exactly why the sign-in page is `/sign-in` and the dashboard is `/`, never `/dashboard`. `types/` contains compile-time contracts, while `config/` contains runtime values that satisfy those contracts. A single `config/item-type-catalog.ts` is the source of truth for built-in item type colors, icons, and routes. The `server/` directory owns read-side persistence access and prepares persistence-independent view models; `actions/` will own write-side Server Actions. Reads go through Prisma end to end; the earlier mock query layer has been fully retired.

---

## 10. Next Steps / Roadmap

A phased build order. Each phase is shippable on its own and de-risks the next. The completed `context/features/dashboard-phase-*.md` documents describe earlier UI-only increments; they are not the same as the product roadmap phases below.

**Phase 0 — Prisma Foundation (next)**
- Set up Neon, connect Prisma, write the first migration (`init`)
- Seed the seven system `ItemType` rows
- Configure `.env.example` and the Prisma client singleton

**Phase 1 — Auth & Shell**
- NextAuth v5 with email/password + GitHub OAuth
- Protected `(dashboard)` layout with collapsible sidebar
- Dark mode (default) + light mode toggle

**Phase 2 — Core CRUD**
- Create / read / update / delete items via the quick-access drawer
- Markdown editor for text types, syntax highlighting for code
- Collections: create, color-coding logic, add/remove items, many-to-many
- Favorites, pinning, recently used

**Phase 3 — Search & Polish**
- Search across content, tags, titles, types
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
- **AI cost controls.** Rate limits / usage caps per Pro user, and graceful handling when the OpenAI call fails or times out.
- **Soft vs hard delete.** Whether deleted items are recoverable (a trash view) or gone immediately — affects schema (`deletedAt`) if you want undo.
- **Data export scope.** Does export include files (ZIP with the actual R2 objects) or just metadata/text (JSON)? The spec implies both formats.
- **Caching strategy.** Redis is marked "maybe" — defer until there's a measured hot path (likely the collections grid and recently-used) rather than adding it upfront.

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
