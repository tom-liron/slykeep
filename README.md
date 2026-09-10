# SlyKeep

One fast, searchable, AI-enhanced hub for everything a developer stashes and looks up again —
snippets, prompts, commands, notes, links, files, and images.

<!-- TODO(rebrand): demo link goes here once the domain lands. -->
<!-- TODO(rebrand): hero screenshot goes here — re-shot after the rename, since the current
     captures in context/screenshots/ show the old name. -->

## The problem

A developer's essentials live in too many places at once: snippets in the editor, prompts buried in
chat history, commands in shell history or a stray `.txt`, links in bookmarks, context files lost
inside a project. Nothing is searchable across the set, so the same lookup gets re-done from memory
every few weeks.

SlyKeep is one place for all of it, with search that spans types, and AI that does the tedious part
of filing.

## What it does

- **Items** of seven kinds — snippet, prompt, note, command, link, file, image — created and edited
  in a slide-out drawer, so capture never costs a page load.
- **Collections** that hold items of any type, many-to-many: one React snippet can sit in both
  *React Patterns* and *Interview Prep*. A collection takes its accent colour from its dominant
  item type.
- **Search** from a ⌘K command palette, matching titles, descriptions, tags, types, and
  collections.
- **Tags**, scoped per account, case-folded so `React` and `react` cannot both exist.
- **Markdown** rendering for text items, and Monaco with syntax highlighting for code.
- **Favourites and pinning**, with `/favorites` as one dense list across both.
- **AI (Pro)**: auto-tagging, generated descriptions, explain-this-code, and a prompt optimizer.
- **Accounts** via email/password or GitHub, with email verification and password reset.
- **Billing** through Stripe — a free tier of 50 items and 3 collections, and a Pro tier that lifts
  the caps and unlocks file/image uploads and the AI features.

<!-- TODO(rebrand): feature screenshots — dashboard, item drawer, command palette. -->

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 (CSS-first config) + shadcn/ui |
| Database | Neon (PostgreSQL) via Prisma 7 |
| Auth | NextAuth v5 |
| Storage | Cloudflare R2 |
| Rate limiting | Upstash Redis |
| Payments | Stripe |
| AI | OpenAI `gpt-5-nano` |
| Tests | Vitest |

## How it is built

The decisions below are the ones that would not be obvious from reading the file tree, and are the
most interesting thing in the repository.

**Presentation never sees a Prisma record.** Server-only query modules in `src/server/` — each
guarded by `import "server-only"` — build view models before anything reaches a component. `src/lib/`
is client-reachable, so database access deliberately does not live there. The rule this buys: a
schema change touches the query module, not the component tree.

**An item type's identity is in the database; its presentation is not.** `ItemType` persists only a
natural key, an icon, and a colour. The plural label, the route slug, the content type, and whether
the type is Pro-gated are application configuration in `src/config/item-type-catalog.ts`, joined to
the row at the server boundary. Adding a display concern therefore needs no migration.

**The system item types needed a partial unique index.** They are shared rows with `userId = NULL`,
and Postgres treats `NULL`s as distinct in a unique index — so `@@unique([name, userId])` would
happily accept two `('snippet', NULL)` rows. A second, partial index closes it. The corollary is a
live footgun: a Prisma bug leaks `name` into `ItemTypeWhereUniqueInput`, so `findUnique({ name })`
type-checks while being wrong for any user who coins a custom type with the same name.

**Auth is split in two because the proxy runs on the edge.** `src/auth.config.ts` holds what is
edge-safe — providers and pages — and `src/auth.ts` layers the Prisma adapter and the real
`authorize` on top. `src/proxy.ts` denies by default: a new route is protected until it is
explicitly listed as public, rather than the other way round.

**Mutations split on one rule.** A Server Action when the caller only needs success or a message; a
route handler when it needs to read an HTTP status. That is why registration is a route — the form
distinguishes a 400 from a 409 — while changing a password and deleting an account are actions.

**Uploads go through the server, not a presigned URL.** The browser never talks to R2. It costs a
hop, and it means the size, extension, and MIME rules in `src/lib/file-constraints.ts` are enforced
somewhere the client cannot skip, and the bucket needs no public write path at all.

**Deleting an account sweeps R2 by key prefix, not by stored key.** The `User` delete cascades away
every row that could hold a file key, so `users/<id>/` is the only remaining authority on what
belonged to the account — and it also catches objects orphaned by an earlier failed delete. The
sweep runs *after* the row delete, so a failed delete can never destroy a live account's files.
Billing cleanup runs *before* it, for the opposite reason.

**Account deletion asks Stripe, not the local row.** It refuses while a subscription would still
bill, and it checks with Stripe directly so a webhook that never arrived cannot wave someone
through.

**There is no `SKIP_EMAIL_VERIFICATION` flag, deliberately.** A development script
(`npm run user:verify`) does the same job without a switch that could disable a security control in
production. A flag makes `emailVerified` mean "verified, *or* an env var was set", and the account
linking work depends on that column being trustworthy: with it reachable in production, an attacker
registers a victim's address, never confirms it, waits for them to sign in with GitHub, and
auto-linking hands over the account.

**Local production runs cannot reach the production database.** `npm start` sets
`NODE_ENV=production`, and Next then prefers `.env.production` — which once meant a local build was
silently talking to the live database. That file is now named `.env.production.example` (inert to
Next's loader), and `src/server/infra/prisma.ts` refuses a connection URL naming the production endpoint
unless `VERCEL` is set.

**"Recent" means last activity, not newest.** Collection membership is written as a nested write on
the *item*, so a collection's `updatedAt` never moved and recency silently degraded into creation
order. `touchCollections()` now moves it from all three item write paths, taking the union of old
and new membership on an edit — a collection the item left changed as much as the one it joined.

**Search deliberately does not read item bodies.** The palette matches client-side over a
prefetched set of summaries, and list queries never select content — so searching titles, tags and
descriptions costs one small payload, while full-content search would mean shipping every stored
snippet to the browser. Making it server-side is a known, deliberate next step rather than an
oversight.

**Integration tests are quarantined from `npm test`.** `npm run billing:test` drives a real
test-mode Stripe subscription through its whole lifecycle, and `npm run r2:test` sweeps real objects
out of the real bucket — both exist because those call shapes are sent from nowhere else in the app,
so a rejected request would leave every unit test green. They live under a separate Vitest config,
so the default suite stays offline.

## Getting started

```bash
npm install
cp .env.example .env    # fill in the database, auth, and service credentials
npm run db:migrate      # apply migrations
npm run db:seed         # system item types + demo content
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`.env.example` documents every variable. The app runs without the Stripe, R2, OpenAI, and Upstash
credentials — those features fail closed rather than crashing the app — but needs a database and an
auth secret.

## Scripts

**Development**

- `npm run dev` — dev server with hot reload
- `npm run build` / `npm start` — production build, then serve it
- `npm run lint` — ESLint over the project
- `npm run format` — Prettier over the whole tree
- `npm run monaco:sync` — copy the pinned Monaco build into `public/`, so the editor is served from
  this origin rather than a CDN. Runs from `predev` and `prebuild`; rarely invoked by hand

**Database**

- `npm run db:migrate` — create and apply a migration in development
- `npm run db:deploy` — apply pending migrations (production start)
- `npm run db:status` — check the migration history is in sync
- `npm run db:seed` — seed the system item types and the demo content
- `npm run db:seed:types` — the seven system item types only
- `npm run db:reset` — clear every account but the demo user, then reseed
- `npm run db:studio` — open Prisma Studio
- `npm run db:test` — database smoke test

**Tests**

- `npm test` — unit tests, offline; the integration suite is excluded
- `npm run billing:test` — drive a real test-mode Stripe subscription through its whole life.
  Requires an `sk_test_` key and refuses otherwise
- `npm run r2:test` — write and sweep real objects under a synthetic prefix in the R2 bucket

**Helpers**

- `npm run user:verify -- <email>` — mark a development account email-verified
- `npm run users:sweep` — delete unverified accounts past their TTL (also runs nightly via cron)
- `npm run email:test` — send through Resend and poll the real outcome

> Schema changes always go through `prisma migrate` — never `prisma db push`, and never a direct
> edit to the production schema.

## Project structure

```
src/
├── app/          # App Router routes; (auth), (dashboard), (marketing) route groups
├── actions/      # Server Actions for mutations
├── components/   # UI primitives and feature-focused presentation components
├── config/       # runtime product and presentation configuration
├── generated/    # Prisma Client, written by `prisma generate` — never edited
├── hooks/        # shared client hooks
├── lib/          # framework-agnostic helpers, schemas, and service clients
├── server/       # server-only queries and view-model preparation
└── types/        # shared contracts and persistence-independent view models
```

`types/` holds compile-time contracts; `config/` holds the runtime values that satisfy them.
`server/` owns reads, `actions/` owns writes.

## Documentation

- [`context/project-overview.md`](context/project-overview.md) — the internal product spec: data
  model, roadmap, and the open questions still being decided. Written for people working on the
  project, not for a first read.
- [`context/feature-history.md`](context/feature-history.md) — every feature shipped, in order.
- [`context/coding-standards.md`](context/coding-standards.md) — the conventions this code follows.
- [`context/decisions.md`](context/decisions.md) — design questions that were open and are now
  closed, with the reasoning that closed them.
- [`.claude/skills/docs-style/SKILL.md`](.claude/skills/docs-style/SKILL.md) — the standard every
  comment in `src/` is written to.
- [`docs/`](docs/) — plan documents written before each subsystem was built. Dated records of the
  reasoning, not maintained descriptions of the current code.
