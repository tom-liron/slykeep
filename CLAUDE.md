# DevStash

A developer knowledge hub for snippets, commands, prompts, notes, files, images, links, and custom types.

## Context Files

Read the following to get the full context of the project:
- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/current-feature.md

## Commands

- `npm run dev` — start the dev server (http://localhost:3000) with hot reload
- `npm run monaco:sync` — copy the pinned monaco build into `public/`, so the editor is served
  from this origin rather than a CDN. Runs automatically from `predev` and `prebuild`; it is a
  no-op when the copy already matches the installed version, so it is rarely run by hand
- `npm run build` — production build
- `npm start` — serve the production build (run `build` first)
- `npm run lint` — ESLint over the project
- `npm run format` — format the whole project with Prettier (not for routine work — see `context/ai-interaction.md`)
- `npm test` — run unit tests (offline; the integration suite is excluded)
- `npm run billing:test` — drive a real test-mode Stripe subscription through its whole life and
  assert what our own code writes at each step. Needs `STRIPE_SECRET_KEY` to be an `sk_test_` key
  and refuses otherwise; creates and deletes its own throwaway user and customer, so no existing
  account is touched. Run it before and after any change to billing.

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

- The file is `.env.production.reference`. Next does not auto-load that name, so `npm start` falls
  back to `.env` and a local production build runs against the development branch, which is what was
  always intended. Vercel is unaffected — it holds its own environment variables.
- `src/lib/prisma.ts` refuses to open a connection whose URL names the production endpoint unless
  `VERCEL` is set. `ALLOW_PRODUCTION_DB=1` is the deliberate override. The Prisma CLI does not import
  that module, so `db:deploy` against production still works.

The rule this enforces is the one in the Neon section above: production is off-limits unless it is
named explicitly in the request. That rule was written for MCP calls, and the gap was that a plain
`npm start` could reach the same database without going near MCP.

## Course Mapping

This project follows a course, but has deliberately diverged from it where our own refactors landed somewhere better. When a lesson's file path doesn't exist here, this is why:

| Course | Here | Why |
|--------|------|-----|
| `src/lib/db/*.ts` | `src/server/*.ts` | Server-only query modules live in `server/`, guarded by `import "server-only"`. `lib/` is client-reachable (components import `@/lib/format`, `@/lib/utils`), so database access must not live there. |
| Prisma records passed to components | `*ViewModel` types in `src/types/view-models.ts` | Presentation depends on view models, never on persistence shape. Query modules build them at the server boundary. |
| `SKIP_EMAIL_VERIFICATION` env var | `npm run user:verify -- <email>` (`scripts/verify-user.ts`) | Same development capability — get a test account past the verification gate without an inbox — without a switch that can disable a security control in production. The lesson's flag sets `emailVerified` with no proof and is explicitly enabled on Vercel, which makes the column mean "verified, **or** an env var was set". The account-linking work the course reaches next depends on that column being trustworthy: with the flag reachable in production, an attacker registers `victim@x.com`, never confirms it, waits for the victim to sign in with GitHub, and auto-linking hands over the account. A script a developer runs against a dev database cannot do that. Registration here also does not hard-fail when a send is refused (the lesson's does) — the account is created and the UI says the email could not be sent, so the flag's other purpose does not apply either. |

Keep the course's **function names** (`getCollections()`, …) so lesson logic transfers line for line; only the import path and return type differ.
