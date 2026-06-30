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

| Type | Data Kind | Route | Pro Only |
|------|-----------|-------|----------|
| Snippet | text | `/items/snippets` | — |
| Prompt | text | `/items/prompts` | — |
| Note | text | `/items/notes` | — |
| Command | text | `/items/commands` | — |
| Link | url | `/items/links` | — |
| File | file | `/items/files` | ✅ |
| Image | file | `/items/images` | ✅ |

Each type resolves to one of three **content kinds**: `text` (snippet, note, prompt, command), `url` (link), or `file` (file, image).

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

> Rough draft — not set in stone. Uses PostgreSQL (Neon) via Prisma 7.
> **Rule:** never use `prisma db push` or edit the DB structure directly. All schema changes go through **migrations**, run in dev first, then prod.

```prisma
// ----- User (extends NextAuth) -----
model User {
  id                   String       @id @default(cuid())
  email                String       @unique
  name                 String?
  image                String?

  // Monetization
  isPro                Boolean      @default(false)
  stripeCustomerId     String?      @unique
  stripeSubscriptionId String?      @unique

  // Relations
  items                Item[]
  collections          Collection[]
  itemTypes            ItemType[]   // custom types; null owner = system type
  accounts             Account[]    // NextAuth
  sessions             Session[]    // NextAuth

  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt
}

// ----- Item -----
model Item {
  id          String           @id @default(cuid())
  title       String
  contentType ContentType      // TEXT | FILE
  content     String?          // text content, or null if file
  fileUrl     String?          // Cloudflare R2 URL, or null if text
  fileName    String?          // original filename
  fileSize    Int?             // bytes
  url         String?          // for link types
  description String?
  language    String?          // optional, for code highlighting
  isFavorite  Boolean          @default(false)
  isPinned    Boolean          @default(false)

  // Relations
  userId      String
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  itemTypeId  String
  itemType    ItemType         @relation(fields: [itemTypeId], references: [id])
  tags        Tag[]
  collections ItemCollection[] // many-to-many via join table

  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  @@index([userId])
}

// ----- ItemType -----
model ItemType {
  id       String  @id @default(cuid())
  name     String
  icon     String  // lucide-react icon name
  color    String  // hex
  isSystem Boolean @default(false)

  // Relations — user is null for system types
  userId   String?
  user     User?   @relation(fields: [userId], references: [id], onDelete: Cascade)
  items    Item[]
}

// ----- Collection -----
model Collection {
  id            String           @id @default(cuid())
  name          String           // "React Hooks", "Prototype Prompts", ...
  description   String?
  isFavorite    Boolean          @default(false)
  defaultTypeId String?          // default type for new, empty collections

  // Relations
  userId        String
  user          User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  items         ItemCollection[] // many-to-many via join table

  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  @@index([userId])
}

// ----- ItemCollection (join table) -----
model ItemCollection {
  itemId       String
  collectionId String
  addedAt      DateTime   @default(now()) // when the item was added to the collection

  item         Item       @relation(fields: [itemId], references: [id], onDelete: Cascade)
  collection   Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)

  @@id([itemId, collectionId])
}

// ----- Tag -----
model Tag {
  id    String @id @default(cuid())
  name  String
  items Item[]
}

enum ContentType {
  TEXT
  FILE
}
```

> **Notes / open questions**
> - `Tag` is currently global. Consider scoping tags per-user (`userId`) and uniquely indexing `@@unique([userId, name])` to avoid cross-user collisions.
> - NextAuth `Account` and `Session` models are assumed but omitted above for brevity — they come from the NextAuth Prisma adapter.

---

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
┌─────────────┬──────────────────────────────────────┐
│  SIDEBAR    │  MAIN                                  │
│ (collapsible)│                                       │
│             │  ┌───────┐ ┌───────┐ ┌───────┐         │
│  Item Types │  │ Coll. │ │ Coll. │ │ Coll. │  ← grid │
│   Snippets  │  │ card  │ │ card  │ │ card  │   of    │
│   Commands  │  └───────┘ └───────┘ └───────┘  cards  │
│   Prompts…  │                                        │
│             │  ┌──────┐ ┌──────┐ ┌──────┐            │
│  Latest     │  │ item │ │ item │ │ item │  ← items   │
│  Collections│  └──────┘ └──────┘ └──────┘            │
│             │                                        │
└─────────────┴──────────────────────────────────────┘
        Item opens in a quick-access DRAWER ▸
```

- **Sidebar:** item types (each linking to its items list), plus latest collections.
- **Main:** grid of **color-coded collection cards** — background color reflects the type the collection holds most of. Items appear as cards with a **colored border** matching their type.
- **Drawer:** individual items open in a fast slide-out drawer for view / edit / create.

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

## 9. Suggested Project Structure

A pragmatic Next.js App Router layout. Adjust as the app grows — this is a starting point, not a mandate.

```
devstash/
├── prisma/
│   ├── schema.prisma
│   └── migrations/              # migration history (never edit applied ones)
├── public/
├── src/
│   ├── app/
│   │   ├── (auth)/              # sign-in / sign-up routes, no sidebar
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/        # authed app, sidebar layout
│   │   │   ├── layout.tsx       # sidebar + main shell
│   │   │   ├── page.tsx         # collections grid (home)
│   │   │   ├── items/
│   │   │   │   └── [type]/      # /items/snippets, /items/links, ...
│   │   │   ├── collections/
│   │   │   │   └── [id]/
│   │   │   ├── search/
│   │   │   └── settings/        # account, billing, export
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/
│   │   │   ├── items/
│   │   │   ├── collections/
│   │   │   ├── upload/          # R2 presigned URLs / uploads
│   │   │   ├── ai/              # tag, summarize, explain, optimize
│   │   │   ├── export/          # JSON / ZIP
│   │   │   └── stripe/          # checkout + webhook
│   │   ├── layout.tsx           # root, theme provider
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                  # shadcn/ui primitives
│   │   ├── items/               # item card, item drawer, editor
│   │   ├── collections/         # collection card, grid
│   │   └── layout/              # sidebar, topbar, mobile drawer
│   ├── lib/
│   │   ├── prisma.ts            # singleton Prisma client
│   │   ├── auth.ts              # NextAuth config
│   │   ├── r2.ts                # Cloudflare R2 client
│   │   ├── openai.ts            # AI client + prompt helpers
│   │   ├── stripe.ts            # Stripe client
│   │   └── limits.ts            # free-tier gating (items/collections)
│   ├── server/                  # server actions / data-access functions
│   │   ├── items.ts
│   │   ├── collections.ts
│   │   └── search.ts
│   ├── hooks/
│   ├── types/
│   └── config/
│       └── item-types.ts        # system types: colors, icons, routes
├── .env                         # secrets (gitignored)
├── .env.example                 # documented placeholders, committed
└── package.json
```

A few deliberate choices worth noting: route groups `(auth)` and `(dashboard)` keep the signed-out and signed-in shells separate without affecting URLs. A single `config/item-types.ts` is the source of truth for the type colors, icons, and routes — so the sidebar, cards, and seed script all read from one place rather than duplicating the hex values. The `server/` directory centralizes data access so free-tier limit checks live in one layer instead of being scattered across API routes.

---

## 10. Next Steps / Roadmap

A phased build order. Each phase is shippable on its own and de-risks the next.

**Phase 0 — Foundations**
- Scaffold Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui
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
- **How collection card color is computed.** "Background color based on the type it holds most of" needs a tie-break rule (e.g. most recent wins) and a fallback for empty collections (`defaultTypeId`).
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
