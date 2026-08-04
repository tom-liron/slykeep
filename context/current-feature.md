# Current Feature: Item Listing Responsive Grid

## Feature

Change the item listing view (`/items/[slug]`) from a single-column stack to a responsive grid:
stacked on small viewports, 2 columns on medium, 3 columns on large.

## Status

In Progress

## Goals

- `/items/[slug]` renders its items in a responsive grid instead of `space-y-3`
- One column stacked, two once there is room, three on large screens — using the card-grid classes
  the collections page and dashboard already use (`grid gap-4 sm:grid-cols-2 lg:grid-cols-3`)
  rather than inventing a second breakpoint set
- Card layout still reads correctly at the narrower column widths
- The empty state and page header are unaffected

## Notes

- Matches the course's `item-list-view` spec, which this project's version of the page diverged
  from — the page was built with a full-width stack.
- Scope is the item-type listing page only. The dashboard (`/`) and the collection detail page
  (`/collections/[id]`) also render `ItemCard`, and keep their current stacked layout.
- `ItemCard` itself should not need changing; it already truncates its title and clamps its
  description, so it degrades to a narrower column without edits. Verify rather than assume.

## History

Moved to `context/feature-history.md`, which is **not** `@`-imported — this file is loaded into
every session and the history is not needed in most of them. `/feature complete` appends there.
