-- The column now holds an R2 object key rather than a URL, and its name said otherwise.
--
-- Written as a rename by hand: Prisma cannot tell a rename from a drop-and-add, and generated
-- `DROP COLUMN "fileUrl"` + `ADD COLUMN "fileKey"`, which discards whatever is in the column. Every
-- row's value is NULL today — no file or image item can exist yet — so the two are equivalent right
-- now, but only one of them stays correct if this migration is ever replayed against data.
ALTER TABLE "items" RENAME COLUMN "fileUrl" TO "fileKey";
