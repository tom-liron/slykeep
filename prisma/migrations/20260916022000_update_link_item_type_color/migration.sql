-- Moves the link type to lime in `ITEM_TYPE_COLORS`. File, image and link were three neighbouring
-- cold hues, which left the sidebar and the card accents hard to tell apart at a glance. The app
-- renders `color` from these rows and only the seed copies the catalogue into them, so without this
-- a deployed database keeps the old colour. Scoped to `userId IS NULL`: a custom type owns its own.
UPDATE "item_types" SET "color" = '#B5E853' WHERE "name" = 'link' AND "userId" IS NULL;
