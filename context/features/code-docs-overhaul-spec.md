# Code Documentation Overhaul

**Scope: the comments and JSDoc inside `src/`.** The planning prose — `README.md`, `context/`,
`docs/` — is a separate feature, `context/features/project-docs-overhaul-spec.md`. Keep them apart:
that one tidies files a reader can choose not to open, this one rewrites text a reader cannot avoid.

## Why

The comments in this codebase are a **lab notebook**, not documentation. They record how the code
came to be — what was tried, what failed, what was measured off a screenshot, which diagnosis was
wrong before the right one. That is a useful genre and it is the wrong one to leave in the source.

A senior engineer opening a file wants an **operating manual**: what this does, what constrains it,
and what breaks if they change it. Right now they get archaeology first and the answer somewhere
inside it.

Measured 2026-09-02:

| | |
|---|---|
| Comment lines in `src/` (excluding `generated/`) | **8,240 of 27,860 non-blank — 29.6%** |
| Files over 70% comment | `lib/auth-redirects.ts` 82.9%, `config/dashboard.ts` 82.9%, `config/editor.ts` 76.2%, `types/ai.ts` 76.0%, `lib/ai-explain.ts` 73.9%, `lib/ai-optimize.ts` 71.4% |
| Worst single block | `components/items/ItemDrawerToolbar.tsx` — ~150 unbroken lines of narrative before the first JSX element |

That last file is the clearest case. It contains pixel measurements from layouts that were
abandoned, an account of two flex arrangements that failed, and the sentence "Three confident wrong
diagnoses preceded finding it." None of it helps someone move a button; all of it must be read past.

**The archaeology is not lost by cutting it.** `context/feature-history.md` already holds the same
rationale for every feature — that is what it is for. Removing it from the source de-duplicates it
into the place a reader goes deliberately.

## The rule to apply

The test for every existing comment is **"would this change what a competent reader does?"**

Keep:

- Constraints that are load-bearing and non-obvious — "this breakpoint must stay identical to
  `ActionLabel`'s", "`connect` can only target a column, which is why `normalized` is a real one".
- Ordering and safety requirements — why the Stripe cleanup runs before the row delete and the R2
  sweep after it.
- Security reasoning that stops a well-meaning change — why `.svg` is never served inline.
- Non-obvious API behaviour that would otherwise be re-discovered — Prisma's `NULL` handling in
  unique indexes, Safari's clipboard gesture window.

Cut:

- Attempts that were abandoned, and what they looked like when they failed.
- Measurements that were *evidence* rather than *rules* — a pixel width that justified a decision,
  as opposed to one the layout still depends on.
- Narrative about the process of finding the answer.
- Anything restating what the next line of code plainly says.
- Anything already recorded in `feature-history.md` and not needed to work on the file.

Then, where a file has genuine complexity, give it a short module-level JSDoc that says what it is
for and what its invariants are — the thing a reader should have found first.

## Goals

- A reader new to the repo can open any file in `src/` and reach the code without reading a history.
- Comment density in `src/` lands well under the current 29.6%. The number is a symptom, not the
  target — no comment is deleted for the count, and no genuinely load-bearing constraint is lost
  to reach it.
- Every module that needs one has a short JSDoc header stating purpose and invariants.
- No behaviour changes. This feature edits comments; a code change found necessary is recorded and
  taken separately.
- The test suite is untouched and stays green — it is the proof that nothing but text moved.

## How to run it

Do **not** attempt this as one sweep. It is ~150 files and the risk is deleting a constraint that
was the only record of a real hazard.

Go directory by directory, in this order, each its own reviewable pass:
`config/` → `types/` → `lib/` → `hooks/` → `server/` → `actions/` → `app/api/` → `components/`.

`config/` and `types/` first because they are the smallest and the most over-commented, so the rule
gets calibrated on cheap files before it reaches `components/`, which is the largest and the one
where a lost layout constraint costs the most.

## Decisions needed before implementation

1. **Where the cut archaeology goes.** Most of it is already in `feature-history.md`. Options:
   delete outright and trust that; or land it in a per-area `docs/decisions/` file first and delete
   it from the source in the same commit. The second is safer and is real work.
2. **How aggressive to be on `ItemDrawerToolbar.tsx`.** It is the extreme case and also genuinely
   fragile layout — several of its measurements *are* still load-bearing. It may deserve its own
   pass rather than being folded into the `components/` one.
3. **Whether a density ceiling is worth enforcing** afterwards, by lint or by review habit, or
   whether stating the rule is enough.

## Notes

The style being replaced is the house style this project has used throughout, so the rule above is
the change — applying it once without adopting it means the next feature re-creates the problem.
Worth reflecting into `context/coding-standards.md`, which currently says nothing about comments,
as part of this feature.
