# Current Feature: Project Sync Skill

## Feature

A `/project-sync` skill that checks every project markdown file against the real codebase structure
and fixes what has drifted, wired into `/feature load` so a spec is corrected before it becomes the
implementation plan.

## Status

In Progress

## Goals

- `.claude/skills/project-sync/SKILL.md` exists and follows the project's skill conventions: frontmatter with `name`, `description`, `argument-hint`, and a `$ARGUMENTS`-driven check/run mode like `cleanup`
- Default mode reports only; `run`/`fix` reports numbered findings, asks which to fix, and waits
- A path argument scopes the sync to a single file
- Historical records are out of scope and never edited: `context/feature-history.md`, specs for shipped features, `docs/audit-results/`, `prisma/migrations/`
- The checks cover stale paths, instructor-structure leakage per the Course Mapping table, renamed exports, `npm run` commands, the §9 structure tree, `(planned)` vs shipped status, and stack versions
- `/feature load` runs the scoped sync on a spec file before copying goals and notes into `current-feature.md`

## Notes

Motivated by `context/features/item-drawer-spec.md`, which was written against the course's structure
(`lib/db/items.ts`, Prisma records passed to components) and had to be corrected by hand before it
could be implemented. The point of the skill is that the correction stops being a thing to remember.

Two candidate hook points were considered. `/feature load` won for the scoped form — the spec is the
input to implementation, so fixing it there stops the wrong paths propagating into
`current-feature.md` and then into code. A broad sweep at `/feature complete` is the other real case
(the code has just moved, so the structure tree and `(planned)` markers go stale) but is deliberately
left manual: it produces a report that needs acting on mid-merge.

Documentation only — no `src/` changes, so there is nothing here for unit tests to cover.

## History

Moved to `context/feature-history.md`, which is **not** `@`-imported — this file is loaded into
every session and the history is not needed in most of them. `/feature complete` appends there.
