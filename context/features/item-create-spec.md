# Item Create

## Overview

Add new items via a modal dialog. Opens from "New Item" button in top bar.

## Requirements

- Use shadcn Dialog component (not installed yet — `npx shadcn@latest add dialog`)
- Type selector (snippet, prompt, command, note, link)
- Fields shown based on selected type:
  - All types: title (required), description, tags
  - snippet/command: content, language
  - prompt/note: content
  - link: URL (required)
- Server action `createItem` in `src/actions/items.ts`, validated by a Zod schema in
  `src/lib/item-schemas.ts` (beside `updateItemSchema`)
- The Prisma write goes in the action itself — `src/server/` stays read-only, as `updateItem` and
  `deleteItem` already do it
- Toast on success, close modal and refresh
