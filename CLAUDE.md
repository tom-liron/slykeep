# DevStash

A developer knowledge hub for snippets, commands, prompts, notes, files, images, links, and custom types.

## Context Files

Loaded automatically, every session:
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/current-feature.md

Read on demand:
- `context/project-overview.md` — the product and architecture record. Not auto-loaded, because
  most work does not need it and it costs more context than everything else here combined. The
  index below says when to open it.
- `context/decisions.md` — design questions already settled and closed. Read before proposing a
  change to anything §11 covers.
- `context/feature-history.md` — one entry per shipped feature, chronological. Read when the
  question is *why* something is the way it is, or append to it when completing a feature.
- `.claude/skills/docs-style/SKILL.md` — the source-documentation standard. Invoke the
  `docs-style` skill before writing or revising any comment.

### What is in `context/project-overview.md`

Open it when a task touches one of these. Do not answer from memory on any of them.

| § | Subject | Open it when |
|---|---|---|
| 1–4 | Problem, users, core concepts, feature list | Adding or changing a user-facing feature |
| 5 | Data model reasoning | Touching Prisma, migrations, item types, or tags. Carries two traps: the system-type partial unique index, and why `findUnique` by `name` alone is wrong |
| 6 | Tech stack | Adding or upgrading a dependency |
| 7 | Freemium tiers | Touching limits, gating, or pricing copy. Must stay in step with `config/marketing.ts` |
| 8 | UI/UX direction, layout, type colors | Design and rebranding work — but `config/item-type-catalog.ts` and `globals.css` are the source of truth for the palette, not this table |
| 9 | Repository structure and the rules deciding where a file goes | Adding a file and unsure which directory owns it |
| 10 | Roadmap by phase, and what is actually shipped | Asked whether something exists, or what is next |
| 11 | Open questions | Proposing anything architectural. Several obvious-looking improvements are deliberately declined there |
| 12 | Reference links | — |

## Commands

- `npm run dev` — start the dev server (http://localhost:3000) with hot reload
- `npm run monaco:sync` — copy the pinned monaco build into `public/`, so the editor is served
  from this origin rather than a CDN. Runs automatically from `predev` and `prebuild`; it is a
  no-op when the copy already matches the installed version, so it is rarely run by hand
- `npm run build` — production build
- `npm start` — serve the production build (run `build` first)
- `npm run lint` — ESLint over the project
- `npm run format` — format the whole project with Prettier (not for routine work — see `context/ai-interaction.md`)
- `npm run docs:links` — check that every `{@link}` in `src/` resolves to something the reader can
  actually click. `tsc`, ESLint and the build all ignore an unfollowable link, so this is the only
  thing that catches one. Run it after any documentation pass
- `npm test` — run unit tests (offline; the integration suite is excluded)
- `npm run billing:test` — drive a real test-mode Stripe subscription through its whole life and
  assert what our own code writes at each step. Needs `STRIPE_SECRET_KEY` to be an `sk_test_` key
  and refuses otherwise; creates and deletes its own throwaway user and customer, so no existing
  account is touched. Run it before and after any change to billing.
- `npm run r2:test` — put a few objects in the real R2 bucket under a synthetic `users/<id>/` prefix,
  sweep them with `deleteUserObjects`, and verify with a second client that the prefix is empty.
  It exists because `ListObjectsV2` and `DeleteObjects` are sent from nowhere else in the app, so a
  call shape Cloudflare rejects would leave every unit test green and fail only at deletion time.
  The prefix cannot collide with a real account, and the test cleans up after itself.
- `npm run marketing:record` — re-record the landing page's product media into `public/marketing/`:
  the hero walkthrough, one drawer-cropped clip per AI feature, and a dashboard screenshot per device.
  Needs `npm run dev` running; creates and deletes its own Pro account on the dev database and makes
  real OpenAI calls. Pass scene names to redo only some (`-- hero ai-tags screenshots`). Run it after
  any UI change the landing page shows.

## Neon MCP

All Neon MCP operations for this project target the **development** branch — never production — unless I explicitly say otherwise in the request.

- **Project:** `devstash` — id `blue-lab-48337415`
- **Development branch (default target):** `br-royal-glade-asmi66p0`
- **Production branch (off-limits):** `br-cold-frost-asmwwtlg`

Rules:
- Always pass `projectId: blue-lab-48337415` **and** `branchId: br-royal-glade-asmi66p0` on every Neon tool call (`run_sql`, `run_sql_transaction`, `get_database_tables`, `describe_table_schema`, migration tools, etc.).
- ⚠️ Never omit `branchId`. Production is the project's *default* branch, so any call without an explicit `branchId` hits production.
- Never run any operation against `br-cold-frost-asmwwtlg` (production) unless I name production explicitly in that specific request. General approval to "use Neon" is never approval to touch production.
- Never run destructive SQL (DROP, DELETE, TRUNCATE, UPDATE/INSERT without my go-ahead) or any migration/branch-mutation tool against production — ask first, every time.

## Local runs and the production database

`npm start` sets `NODE_ENV=production`, and **Next then loads `.env.production` in preference to
`.env`**. That file held the production Neon connection string, so every local production-mode run —
checking a build, a response header, a route — was silently talking to the live database while
nothing in the command said so. It surfaced only when a scheduled-deletion endpoint was tested that
way and reported a row deleted that the same job had just reported zero of against dev.

Two things now prevent it:

- The file is `.env.production.example`. Next auto-loads `.env`, `.env.local`, `.env.production` and
  `.env.production.local` — and nothing else — so this name is inert, and `npm start` falls
  back to `.env` and a local production build runs against the development branch, which is what was
  always intended. Vercel is unaffected — it holds its own environment variables.
- `src/server/infra/prisma.ts` refuses to open a connection whose URL names the production endpoint
  unless `VERCEL` is set. `ALLOW_PRODUCTION_DB=1` is the deliberate override. The Prisma CLI does not
  that module, so `db:deploy` against production still works.

The rule this enforces is the one in the Neon section above: production is off-limits unless it is
named explicitly in the request. That rule was written for MCP calls, and the gap was that a plain
`npm start` could reach the same database without going near MCP.

## Course Mapping

This project follows a course, but has deliberately diverged from it where our own refactors landed somewhere better. When a lesson's file path doesn't exist here, this is why:

| Course | Here | Why |
|--------|------|-----|
| `src/lib/db/*.ts` | `src/server/*.ts` | Server-only query modules live in `server/`, guarded by `import "server-only"`. `lib/` is client-reachable (components import `@/lib/format`, `@/lib/utils`), so database access must not live there. |
| `src/lib/prisma.ts`, `src/lib/stripe.ts`, `src/lib/r2.ts` | `src/server/infra/*.ts` | The same rule, applied to the integration clients rather than only to queries. `prisma`, `stripe`, `r2`, `openai`, `email`, `rate-limit` and `app-origin` all carry secrets and all import `server-only`, so they belong behind the server boundary. The rule this leaves has no exceptions: **`@/lib/*` is safe to import from anywhere; `@/server/*` is not.** An ESLint override on `src/lib/**` enforces it — that folder may not import `server-only` or `@/server/*`. |
| Prisma records passed to components | `*ViewModel` types in `src/types/view-models.ts` | Presentation depends on view models, never on persistence shape. Query modules build them at the server boundary. |
| `SKIP_EMAIL_VERIFICATION` env var | `npm run user:verify -- <email>` (`scripts/verify-user.ts`) | Same development capability — get a test account past the verification gate without an inbox — without a switch that can disable a security control in production. The lesson's flag sets `emailVerified` with no proof and is explicitly enabled on Vercel, which makes the column mean "verified, **or** an env var was set". The account-linking work the course reaches next depends on that column being trustworthy: with the flag reachable in production, an attacker registers `victim@x.com`, never confirms it, waits for the victim to sign in with GitHub, and auto-linking hands over the account. A script a developer runs against a dev database cannot do that. Registration here also does not hard-fail when a send is refused (the lesson's does) — the account is created and the UI says the email could not be sent, so the flag's other purpose does not apply either. |

Keep the course's **function names** (`getCollections()`, …) so lesson logic transfers line for line; only the import path and return type differ.
