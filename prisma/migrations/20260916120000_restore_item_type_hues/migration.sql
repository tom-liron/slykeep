-- Returns the seven system item types to the hues they carried before the redesign. Reassigning
-- every hue for the Vivid palette cost the types the identity they were read by, and the original
-- assignments sit better in the finished design.
--
-- Six are the exact original values. `file` is not: it was `#6b7280`, a near-neutral at a chroma of
-- 0.023, which against the redesign's near-black surfaces read as a disabled icon rather than as a
-- colour. Slate keeps it the quiet one of the seven without that.
--
-- The app renders `color` from these rows and only the seed copies the catalogue into them, so
-- without this a deployed database keeps the Vivid colours. Scoped to `userId IS NULL`: a custom
-- type owns its colour.
UPDATE "item_types" SET "color" = '#3b82f6' WHERE "name" = 'snippet' AND "userId" IS NULL;
UPDATE "item_types" SET "color" = '#8b5cf6' WHERE "name" = 'prompt'  AND "userId" IS NULL;
UPDATE "item_types" SET "color" = '#f97316' WHERE "name" = 'command' AND "userId" IS NULL;
UPDATE "item_types" SET "color" = '#fde047' WHERE "name" = 'note'    AND "userId" IS NULL;
UPDATE "item_types" SET "color" = '#94A3B8' WHERE "name" = 'file'    AND "userId" IS NULL;
UPDATE "item_types" SET "color" = '#ec4899' WHERE "name" = 'image'   AND "userId" IS NULL;
UPDATE "item_types" SET "color" = '#10b981' WHERE "name" = 'link'    AND "userId" IS NULL;
