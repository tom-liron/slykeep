---
name: project-sync
description: Check every project .md file against the real codebase structure and fix what has drifted (add "run" to apply fixes)
argument-hint: run|check|<path>
---

# Project Sync

Documentation drifts. Files move, functions get renamed, planned things ship, and the course this
project follows uses paths we deliberately don't. This skill finds those mismatches and fixes them.

**Mode: $ARGUMENTS**

- no argument, or `check` — report findings only, change nothing
- `run` or `fix` — report findings numbered, then ask which to fix, wait for the answer, fix only those
- a path (e.g. `context/features/item-drawer-spec.md`) — same as `run`, scoped to that one file

## Scope

In scope — files that describe how the project *is*:

- `CLAUDE.md`, `README.md`
- `context/project-overview.md`, `context/coding-standards.md`, `context/ai-interaction.md`
- `context/current-feature.md`
- `docs/**/*.md`
- `context/features/*.md` that are **not yet implemented** (a spec for work still to come is a plan
  we will follow, so its paths must be ours, not the instructor's)

Never touch — these are records of what happened, and correcting them is falsifying them:

- `context/feature-history.md`
- `context/features/*.md` for features already shipped (check `context/feature-history.md`)
- `docs/audit-results/**`
- `prisma/migrations/**`, `node_modules/`, `.next/`, `src/generated/`, `.claude/skills/*/`

If a shipped spec is badly wrong, say so in the report — don't edit it.

## What to check

Verify each claim against the codebase; never flag from memory. `ls`, `grep`, and reading
`package.json` are the evidence — a path is only wrong once you've confirmed nothing is there.

1. **Paths that don't exist.** Every file and directory a doc names. Distinguish a stale path from
   one explicitly marked `(planned)` — planned entries are fine until the thing ships.
2. **Instructor-structure leakage.** The mappings in `CLAUDE.md` → *Course Mapping*: `src/lib/db/*`
   → `src/server/*`, Prisma records passed to components → `*ViewModel` types, `SKIP_EMAIL_VERIFICATION`
   → `npm run user:verify`. A doc using the left-hand form is drift.
3. **Names.** Exported functions, types, view models, and components a doc references — confirm they
   still exist under that name.
4. **Commands.** Every `npm run …` in a doc exists in `package.json`, and vice versa for documented
   scripts.
5. **The structure tree** in `context/project-overview.md` §9 — new files missing from it, deleted
   files still listed.
6. **Status claims.** Something marked `(planned)` or roadmap-pending that has actually shipped, and
   anything claimed done that isn't. Check the code, not the roadmap's own wording.
7. **Stack versions** in `CLAUDE.md` and `context/project-overview.md` §6 against `package.json`.

## Reporting

One numbered list, grouped by file, each item as `file.md:12 — claim → reality`. State the correction
you'd make, not just the problem. If nothing drifted, say so in one line.

## Fixing

- Minimal edits: correct the wrong path, name, or claim and nothing else. This is not a rewrite pass
  — no restructuring, no tone changes, no "while I was here".
- Keep the doc's own voice and formatting.
- Where a doc explains *why* we diverge from the course, preserve the reasoning; only the facts around
  it get corrected.
- Don't invent status: if you can't tell whether something shipped, report it as a question instead of
  editing it.
- Never delete a file, and never delete a section to resolve a mismatch — correct it or flag it.

`/feature load` calls this automatically, scoped to the spec being loaded, so a spec written against
the course's structure is corrected before it becomes the plan. Run it by hand — unscoped — when a
refactor has moved files, after a phase lands, or when the structure tree looks stale.
