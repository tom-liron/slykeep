# Dashboard Items Spec

## Overview

Replace the dummy item data displayed in the main area of the dashboard (right side), with actual data from the database. This includes both pinned and recent items. It should look how it does now, but instead of using data from the mock query layer in `src/server/mock-data/`, it should be from our Neon database using Prisma.

If there are no pinned items, nothing should display there.

## Requirements

- Create `src/server/items.ts` as a server-only query module (guarded by `import "server-only"`), returning `*ViewModel` types — not Prisma records. (The course's `src/lib/db/items.ts` maps here; see CLAUDE.md → Course Mapping. Keep the course's function names.)
- Fetch items directly in server component
- item card icon/border derived from the item type
- Display item type tags and anything else currently there. You can also reference the screenshot if needed
- Update collection stats display

## References

Check the `@context/screenshots/dashboard-ui-main.png` screenshot if needed, but layout and design is already there.
