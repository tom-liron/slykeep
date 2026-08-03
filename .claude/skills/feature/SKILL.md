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

| Action | Description |
|--------|-------------|
| `load` | Load a feature spec or inline description |
| `start` | Begin implementation, create branch |
| `review` | Check goals met, code quality |
| `test` | Write and run unit tests for the feature's logic |
| `explain` | Document what changed and why |
| `complete` | Commit, push, merge, reset |

Otherwise, read `actions/<action>.md` — that one file only — and follow it.