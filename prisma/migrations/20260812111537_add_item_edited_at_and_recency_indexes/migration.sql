-- DropIndex
DROP INDEX "items_createdAt_idx";

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill. The column default stamps every existing row with the moment this migration ran, which
-- would collapse the whole table to one timestamp and flatten the ordering this column exists to
-- fix. `updatedAt` is the best approximation available for rows written before the split: for
-- anything never favourited or pinned it *is* the edit time, and for the rest it is at worst the
-- reading we already had. Runs before the index is built, so the index is built once on final data.
UPDATE "items" SET "editedAt" = "updatedAt";

-- CreateIndex
CREATE INDEX "collections_userId_updatedAt_idx" ON "collections"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "collections_userId_isFavorite_idx" ON "collections"("userId", "isFavorite");

-- CreateIndex
CREATE INDEX "items_userId_editedAt_idx" ON "items"("userId", "editedAt");

-- CreateIndex
CREATE INDEX "items_userId_isPinned_idx" ON "items"("userId", "isPinned");

-- CreateIndex
CREATE INDEX "items_userId_isFavorite_idx" ON "items"("userId", "isFavorite");
