-- DropIndex
DROP INDEX "items_userId_isPinned_idx";

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "pinnedAt" TIMESTAMP(3);

-- Backfill. Rows already pinned would otherwise carry a NULL here and sort last in the section they
-- are the whole content of. `updatedAt` is the closest thing available to when they were pinned: the
-- pin toggle writes the row, so for anything pinned and not since edited it *is* that moment.
-- Deliberately scoped to pinned rows — an unpinned row must keep NULL, which is what makes the
-- column mean "pinned, at this time" rather than "was pinned once".
UPDATE "items" SET "pinnedAt" = "updatedAt" WHERE "isPinned" = true;

-- CreateIndex
CREATE INDEX "items_userId_isPinned_pinnedAt_idx" ON "items"("userId", "isPinned", "pinnedAt");
