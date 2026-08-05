# Markdown Editor Spec

## Overview

Add a Markdown editor component for notes and prompts with Write/Preview tabs and proper dark theme styling.

## Requirements

- Create MarkdownEditor component with tabbed interface (Write/Preview)
- Replace the Textarea with MarkdownEditor for prose content — the codebase already splits on
  `itemTypeOwns(name).language` (`src/lib/item-schemas.ts`), which is true for snippets and commands
  and false for notes and prompts. Reuse that predicate; do not introduce a second type list.
- Keep CodeEditor for snippets and commands (no changes)
- Use react-markdown with remark-gfm for GitHub Flavored Markdown support
- Match CodeEditor's chrome: the `#171717` surface it declares as `SURFACE` (what `--card` resolves
  to in dark mode), a rounded `border border-border` wrapper, and a header separated by
  `border-b border-border` with no fill of its own
- No copy button in the header — CodeEditor deliberately has none, because the drawer's action bar
  already carries one Copy for every item type, and the create/edit forms are not for copying
- Support both display (readonly) and edit modes
- In readonly mode, only show Preview tab
- In edit mode, default to Write tab with Preview available

## Styling Requirements

- Headings (h1-h6) must be visually distinct with proper sizing and weight
- Code blocks with dark background and monospace font
- Inline code with subtle background highlight
- Lists (ordered/unordered) with proper indentation and bullets
- Blockquotes with left border accent
- Links in blue with hover state
- Tables with borders and header background
- Use custom CSS class (e.g., `.markdown-preview`) for reliable dark mode styling
- Fluid height, matching CodeEditor's `MIN_HEIGHT = 76` floor and `MAX_HEIGHT = 400` ceiling

## Integration Points

- `CreateItemDialog` (`src/components/items/CreateItemDialog.tsx`): use for the note and prompt
  content field
- `ItemEditForm` (`src/components/items/ItemEditForm.tsx`) — edit mode is its own component, rendered
  by `ItemDrawer`: use for the note and prompt content field
- `ItemDrawer` view mode (`src/components/items/ItemDrawer.tsx`): use in readonly mode for note and
  prompt content, replacing the `<pre>` block that renders prose today
