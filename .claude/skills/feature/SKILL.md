---
name: feature
description: Manage current feature workflow - load, start, review, test, explain or complete
argument-hint: load|start|review|test|explain|complete
---

# Feature Workflow

Manages the full lifecycle of a feature from spec to merge.

## Working File

`context/current-feature.md` — each action reads it when it needs it.

### File Structure

current-feature.md has these sections:

- `# Current Feature` - H1 heading with feature name when active
- `## Status` - Not Started | In Progress | Complete
- `## Goals` - Bullet points of what success looks like
- `## Notes` - Additional context, constraints, or details from spec
- `## History` - a pointer only; the entries live in `context/feature-history.md`

`context/feature-history.md` holds the completed-feature log (append only). It is deliberately not
`@`-imported by `CLAUDE.md`, so read it only when past feature rationale is actually needed.

## Task

Execute the requested action: $ARGUMENTS

**If no action was provided:** print the table below, ask which action to run, and stop. Do not read any action file, do not read `current-feature.md`, do not investigate anything. This is a one-message response.

**The flow** — every feature runs these three, in this order:

| Action | Description |
|--------|-------------|
| `load` | Load a feature spec or inline description |
| `start` | Create the branch, implement, test, and report what to check in the browser |
| `complete` | Record, commit, merge, delete the branch, push |

**On demand** — reach for these when something needs it, not as stages. A feature that goes
straight from `start` to `complete` is the normal case, not a corner cut:

| Action | Description | Reach for it when |
|--------|-------------|-------------------|
| `review` | Check goals met, code quality, scope creep | Before completing something large or risky |
| `test` | Add unit tests to code that already shipped without them | `review` says coverage is thin, or tests were skipped to move fast |
| `explain` | Document what changed and why, in depth | The short summary `start` prints is not enough |

`start` writes tests where a feature warrants them — many do not — and runs the full gate either
way, so `test` is not a stage between the two. It is the repair for code that shipped without tests
it should have had.

Otherwise, read `actions/<action>.md` — that one file only — and follow it.