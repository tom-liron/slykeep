# Content Types

## Output

`docs/item-types.md`

## Research

Document all 7 system item types (snippet, prompt, command, note, file, image, link).

## Include

Per type: persisted `name`, Lucide icon, hex color, route slug, `ContentType`, Pro gating, purpose,
and the `Item` columns it actually populates.

Summaries: TEXT vs FILE vs URL classification, properties shared by every type, and where types
differ in display.

Also cover the split this project made and the course did not: `ItemType` persists identity only
(`name`, `icon`, `color`, `isSystem`, `userId`), while label, slug, content type, and Pro gating are
application config in `config/item-type-catalog.ts`, joined into an `ItemTypeViewModel` at the server
boundary.

## Sources

- @context/project-overview.md — §4A type table, §5 identity-vs-presentation rules, §8 colors/icons
- @context/feature-history.md — entries 9, 11, 14, 15 (identity alignment, seed, DB-backed reads)
- @prisma/schema.prisma — `ItemType`, `Item`, `ContentType` enum, the partial unique index
- @src/config/item-type-catalog.ts — the catalog: label, icon, color, slug, contentType, isPro
- @src/types/item-type.ts — `ItemTypeName`, `IconName`, `ContentType`, `ItemTypePresentation`
- @src/types/view-models.ts — `ItemTypeViewModel`, `ItemSummaryViewModel`, `ItemTypeCountViewModel`
- @src/server/view-models.ts — `toItemTypeViewModel`, where persisted `name`/`icon` are validated
- @src/server/item-types.ts and @src/server/items.ts — how types are read, counted, and routed
- @src/components/items/TypeIcon.tsx and @src/components/items/ItemCard.tsx — icon/accent rendering
- @src/lib/limits.ts and @src/config/access.ts — `canAccessItemType`, `ENFORCE_PRO_LIMITS`
- @prisma/seed.ts and @prisma/seed-data.ts — how catalog values reach the database, demo content

Note: there is no `src/lib/constants.tsx` in this project — item-type presentation lives in
`src/config/item-type-catalog.ts`. See the Course Mapping table in `CLAUDE.md`.
