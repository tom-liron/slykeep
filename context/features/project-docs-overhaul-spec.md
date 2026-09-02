# Project Documentation Overhaul

**Scope: the planning prose only** — `README.md`, `context/`, and `docs/`. The comments and JSDoc
inside `src/` are a separate feature with its own spec,
`context/features/code-docs-overhaul-spec.md`, and the two must not be merged: this one is about
files nobody has to read to work on the code, and that one is about text a reader cannot avoid.

## Why

The repo's prose has been edited in place for months and now mixes three things that read
identically: the original plan, decisions since made, and rows that quietly went stale. A reader
cannot tell which is which, and neither can a future session — `project-overview.md` is
`@`-imported into every conversation, so its stale rows are actively re-taught.

This is a feature with a spec, not a cleanup pass. It changes no code.

## Findings already established

These were found and verified on 2026-09-02. They are the starting list, not the whole job.

**The README is the front door and does not act like one.** 67 lines, essentially a scripts
reference. No screenshot, no demo link, no statement of the problem, and nothing about the
engineering decisions that are the most interesting thing here. Its one narrative link points a
first-time reader at `context/project-overview.md` — a 545-line internal spec whose §11 is a list of
open questions. That is the wrong destination for someone deciding whether to keep reading.

**`project-overview.md` §7 has two stale rows.** `Search | Basic | Basic` compares nothing — the
shipped pricing card is correct, giving Free `"Instant ⌘K search"` and Pro `"Everything in Free,
plus"`, so there is no tier distinction to describe. Decided: keep one search for everyone and fix
the table. And `Export (JSON / ZIP) | ❌ | ✅` promises a feature whose row was deliberately *pulled*
from the shipped card because no route exists behind it.

**`feature-history.md` has two entries numbered 113.** Entry 114 follows them and 115 is appended,
so the sequence is 111, 112, 113, 113, 114, 115. Renumbering edits the record, which is why it was
left for this feature rather than patched in passing.

**A note about drift is itself drift.** `current-feature.md` claims
`docs/stripe-integration-plan.md` cites a research file that does not exist. It does exist —
`context/research/stripe-integration-research.md`, 68 lines. Remove the note.

**Markdown line anchors rot silently.** `file.ts#L42` breaks whenever the file moves and nothing
checks it. Five of six in `docs/item-types.md` had drifted before 2026-09-01. The scale is larger
than that one file suggests: **74 anchors across three `docs/` files** — 57 of them in
`ai-tagging-walkthrough.md`, 11 in `item-crud-architecture.md`, 6 in `item-types.md`.

**Two `docs/` plan files describe tags as global rows.** `item-crud-architecture.md` and
`ai-integration-plan.md` predate feature #112, which gave `Tag` a `userId` and a `normalized`
column. Left alone so far as dated plan records.

## The shape of what is there

| Area | Size | What it is |
|---|---|---|
| `README.md` | 67 lines | the front door |
| `context/project-overview.md` | 545 lines | product spec, `@`-imported every session |
| `context/feature-history.md` | 212 lines | 115 entries, append-only |
| `context/portfolio-direction.md` | 113 lines | what this project is for; cited by `current-feature.md` |
| `docs/*.md` | ~3,760 lines over 5 files | plan documents and one walkthrough, written before the work |
| `docs/audit-results/*.md` | ~2,940 lines over 4 files | agent audit output |
| `context/features/*.md` | 35 files | per-feature specs, historical |
| `context/research/*.md` | 4 files | research notes |
| `context/screenshots/` | 2 PNGs | `dashboard-ui-main`, `dashboard-ui-drawer` — the only images in the repo |

Roughly 9,960 lines of prose. The five `docs/` plan files and the four audit reports are 6,700 of
it and are the least likely to be read. `docs/ai-tagging-walkthrough.md` alone is 1,002 lines.

## Goals

- The README stands on its own: what this is, what it does, how it is built, and what is
  interesting about how it is built — without sending a first-time reader into an internal spec.
- `project-overview.md` §7 matches the shipped pricing card.
- Every document declares what kind of document it is. A plan written before the work and never
  revised is a *record* and should say so in its own header; a document meant to be current must
  actually be current. The failure mode being fixed is a reader unable to tell them apart.
- `feature-history.md` numbering is contiguous.
- Nothing in `context/` or `docs/` contradicts the code. Where a statement cannot be verified
  cheaply, it is removed rather than left standing.
- No code changes. If the docs pass finds a real defect, it is recorded and taken as its own fix.

## Decisions needed before implementation

1. **README scope.** A full rewrite with screenshots and a feature tour is worth more once the
   rebrand and domain land — screenshots taken now show the old name. Options: rewrite the prose now
   and leave marked placeholders for images and the demo link, or rewrite the structure now and do
   the visual pass in the rebrand batch.
2. **`docs/` plan files and `docs/audit-results/`.** 6,700 lines over nine files, mostly
   superseded. Three ways: leave them and add a dated "record, not current" header to each; move
   them under `docs/archive/`; or delete the audit output, which any agent can regenerate. Pick one
   rule and apply it to all nine.
3. **`context/features/` — 35 spec files.** Same question, and the answer should probably match
   whatever (2) gets.
4. **Renumbering `feature-history.md`.** Fixing the duplicate 113 shifts 114 and 115. Entries cite
   each other by number, but the only three references in the file are **#3, #44 and #111** — all
   below the duplicate — so renumbering the tail (the second 113 → 114, 114 → 115, 115 → 116)
   breaks nothing. The alternative is accepting one duplicate and appending a note.

## Notes

Run `/project-sync` as part of this feature, not instead of it. It checks `.md` files against the
real structure and fixes paths that have drifted — mechanical, and it will not notice a row that is
merely wrong.

`CLAUDE.md` and its four `@`-imports are the files that cost context on every single session. They
carry the strongest case for being short and true, and the least tolerance for stale rows.

The `.claude/` skill and agent definitions are out of scope, and so is every comment inside `src/` —
see the scope note at the top.
