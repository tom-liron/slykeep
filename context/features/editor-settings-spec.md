# Editor Preferences Settings

## Overview

Add editor preferences section to settings page with auto-save to database.

## Requirements

- Font size dropdown
- Tab size dropdown
- Word wrap toggle (default: on)
- Minimap toggle (default: off)
- Theme dropdown: vs-dark, monokai, github-dark (default: vs-dark) — **open:** `monokai` and
  `github-dark` are not Monaco built-ins (it ships `vs`, `vs-dark`, `hc-black`, `hc-light` only), and
  `CodeEditor` does not use `vs-dark` directly — it defines `devstash-dark` on top of it in
  `beforeMount`, taking its chrome from `EDITOR_SURFACE`. Either the two extra themes get
  hand-written `defineTheme` token rules, or the list narrows to what exists. Decide when the
  dropdown is built.
- Store in JSON column `editorPreferences` on User model, in `prisma/schema.prisma`. The settings
  page consumes view models, so the preferences also need a shape in `src/types/view-models.ts`
  rather than the raw `Json` value reaching a component.
- Create and run a migration for the database (Never db push)
- Create server action to update preferences, in `src/actions/` — account mutations are Server
  Actions here, not routes. Zod contract in `src/lib/`; the read joins `getAccountSettings()` in
  `src/server/profile.ts`, which is what `/settings` already calls.
- Apply settings to the Monaco editor component, `src/components/items/CodeEditor.tsx`, where all
  four preferences are currently hardcoded in its `options` block (`fontSize: 13`, `tabSize: 2`,
  `wordWrap: "on"`, `minimap: { enabled: false }`). Note `wordWrap` feeds the `getContentHeight()`
  measurement, so toggling it changes the editor's height.
- Decide the same for `src/components/items/MarkdownEditor.tsx`, the app's other content surface.
  `src/config/editor.ts` exists precisely so the two cannot drift on presentation, so font size — and
  arguably word wrap — belongs to both, not to Monaco alone.
- Auto-save on change (no save button)
- Show success toast on save
- Create EditorPreferencesContext for client components, as
  `src/components/settings/EditorPreferencesContext.tsx` — React modules are named after the provider
  they export (see `src/components/layout/SidebarContext.tsx`, the only existing context).

