# Current Feature: Code Editor

## Feature

Spec: `context/features/code-editor-spec.md`

A Monaco-backed `CodeEditor` component that replaces the plain textarea for code items (snippets and
commands) in both the read-only drawer view and the edit/create forms, styled as a macOS window with
a header carrying the language and a copy button.

## Status

In Progress

## Goals

- Add a `CodeEditor` component (Monaco, dark theme) under `src/components/items/`.
- Use it in place of `Textarea` for the **content** field of `snippet` and `command` items only —
  `note`, `prompt`, and every other type keep the existing `Textarea`. The existing
  `itemTypeOwns(name).language` predicate already means exactly "this type's content is code"
  (`TYPES_WITH_LANGUAGE = { snippet, command }` in `src/lib/item-schemas.ts`), so gate on it rather
  than hard-coding a second type list.
- Support both modes: read-only display (the drawer's body `<pre>` in
  `src/components/items/ItemDrawer.tsx`) and editing (`ItemEditForm.tsx`, `CreateItemDialog.tsx`).
- macOS-style window chrome: red / yellow / green dots at the top-left of the editor header.
- ~~Copy-to-clipboard button in the header~~ — **dropped, deliberately.** Built, then removed: in
  the drawer it duplicated the action bar's existing Copy exactly, and in the create and edit forms
  it was the only copy button but also the one place copying is beside the point. One copy
  affordance per item, in the action bar, where every type has it.
- Show the item's language in the header next to the copy button.
- Fluid height that grows with the content up to a **400px** max, with a themed custom scrollbar.

## Notes

- **Language source.** `Item.language` already exists end to end — persisted, selected in
  `src/server/items.ts`, exposed as `ItemDetailViewModel.language` (empty string when unset), and
  edited via the `showsLanguage` field in `ItemEditForm`/`CreateItemDialog`. Feed it to Monaco as the
  model language and render it in the header; decide a sensible fallback (`plaintext`) when empty.
- **New dependency.** Monaco is not installed yet — `@monaco-editor/react` (which loads
  `monaco-editor`) is the standard Next.js path. It is client-only, so the component needs
  `"use client"` and the editor should be loaded dynamically to keep it out of the server bundle.
  Watch the bundle-size cost; this is the first heavy client dependency in the project.
- **Theme.** Dark-mode-first per the coding standards. Define the Monaco theme from the app's CSS
  variables rather than shipping a second, unrelated palette.
- **Scrollbar.** Monaco draws its own scrollbars (`scrollbar` options, `scrollBeyondLastLine: false`)
  — style those, and set `automaticLayout` so the fluid height re-measures.
- **Not in scope.** Markdown editor for text types (Phase 2 roadmap item), syntax highlighting
  anywhere outside the item body, and any schema change.

### Spec sync

`/project-sync` found no drift in `context/features/code-editor-spec.md` — the spec names no project
paths, functions, or commands, so nothing needed correcting. The mapping onto our structure (the
`itemTypeOwns` language predicate, the three call sites, the existing `language` field) is recorded
in the goals above.

## History

Moved to `context/feature-history.md`, which is **not** `@`-imported — this file is loaded into
every session and the history is not needed in most of them. `/feature complete` appends there.
