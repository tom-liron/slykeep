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
- `npm run build` — production build
- `npm start` — serve the production build (run `build` first)
- `npm run lint` — ESLint over the project
- `npm run format` — format the whole project with Prettier (not for routine work — see `context/ai-interaction.md`)
- `npm test` — run unit tests

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

## Course Mapping

This project follows a course, but has deliberately diverged from it where our own refactors landed somewhere better. When a lesson's file path doesn't exist here, this is why:

| Course | Here | Why |
|--------|------|-----|
| `src/lib/db/*.ts` | `src/server/*.ts` | Server-only query modules live in `server/`, guarded by `import "server-only"`. `lib/` is client-reachable (components import `@/lib/format`, `@/lib/utils`), so database access must not live there. |
| Prisma records passed to components | `*ViewModel` types in `src/types/view-models.ts` | Presentation depends on view models, never on persistence shape. Query modules build them at the server boundary. |

Keep the course's **function names** (`getCollections()`, …) so lesson logic transfers line for line; only the import path and return type differ.
