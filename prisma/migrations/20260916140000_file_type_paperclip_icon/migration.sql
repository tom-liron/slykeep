-- Moves the file type off lucide's `File`. That glyph and `StickyNote`, which Notes uses, are both
-- a rounded rectangle with a folded corner, and at the 16px the sidebar and the item rows draw them
-- at the two types read as one icon. `Paperclip` is a curve rather than a rectangle, so it cannot be
-- confused with Notes or Images, and an attachment is what the type holds.
--
-- The app renders `icon` from this row and only the seed copies the catalogue into it, so without
-- this a deployed database keeps the old glyph. Scoped to `userId IS NULL`: a custom type owns its
-- icon.
UPDATE "item_types" SET "icon" = 'Paperclip' WHERE "name" = 'file' AND "userId" IS NULL;
