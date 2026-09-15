-- Moves the seven system item types to the Vivid palette in `ITEM_TYPE_COLORS`. The app renders
-- `color` from these rows and only the seed copies the catalogue into them, so without this a
-- deployed database keeps the old colours. Scoped to `userId IS NULL`: a custom type owns its colour.
UPDATE "item_types" SET "color" = '#FF5C5C' WHERE "name" = 'snippet' AND "userId" IS NULL;
UPDATE "item_types" SET "color" = '#FF8F40' WHERE "name" = 'prompt'  AND "userId" IS NULL;
UPDATE "item_types" SET "color" = '#3DD68C' WHERE "name" = 'command' AND "userId" IS NULL;
UPDATE "item_types" SET "color" = '#F266B3' WHERE "name" = 'note'    AND "userId" IS NULL;
UPDATE "item_types" SET "color" = '#5B9DFF' WHERE "name" = 'file'    AND "userId" IS NULL;
UPDATE "item_types" SET "color" = '#A987FF' WHERE "name" = 'image'   AND "userId" IS NULL;
UPDATE "item_types" SET "color" = '#2FD0E6' WHERE "name" = 'link'    AND "userId" IS NULL;
