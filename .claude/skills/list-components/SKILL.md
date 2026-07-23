---
name: list-components
description: List project components
argument-hint: "[subdirectory]"
---

## Task

List all React component files (.tsx, .ts, .jsx, .js) in the components folder.

**Exclude non-component files** — do not list or count:

- Test files: `*.test.*`, `*.spec.*`, and anything under `__tests__/`
- Story files: `*.stories.*`
- Type-only / config / barrel files that export no component (e.g. `index.ts` re-exports, `*.d.ts`)

If a file matches the extension glob but is not an actual component, leave it out entirely.

If a [subdirectory] is provided via $ARGUMENTS, only list files in that subdirectory.

## Output Format

- Numbered list of component files with relative paths
- Brief one-line description of each (infer from filename)
- Summary count at the end — count **components only**

If no files found, say "No components found."
