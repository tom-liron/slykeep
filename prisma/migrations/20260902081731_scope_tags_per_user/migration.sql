-- Scope tags per user: `Tag.name @unique` (global) becomes `@@unique([userId, normalized])`.
--
-- This is a data migration, not just DDL. Two things have to be resolved before the constraint can
-- exist, and neither is currently present in any environment — which is exactly why it is being done
-- now rather than after launch:
--
--   1. SPLIT. A tag row reached by two different users' items has to become one row per user, with
--      each user's join rows repointed at their own copy.
--   2. COLLAPSE. `react` and `React` were two rows under the old global unique index; per user they
--      are now one, so the losing rows are merged into the winner.
--
-- The plan is computed into two temporary tables first, then applied. Doing it in one pass of
-- UPDATEs is what makes this hard to get right: repointing join rows in place can move two rows onto
-- the same (A, B) pair — an item that carried both `react` and `React` — which violates the join
-- table's primary key mid-statement. Rebuilding the join from a deduplicated plan sidesteps that
-- entirely.

-- The new columns, nullable while the backfill runs.
ALTER TABLE "tags" ADD COLUMN "userId" TEXT;
ALTER TABLE "tags" ADD COLUMN "normalized" TEXT;

-- Dropped up front, not at the end. Splitting a shared tag inserts a *second* row named `react`,
-- which the old global index forbids — so the backfill cannot run while it exists. This ordering is
-- the one thing here that a migration written against today's data would not have caught, since with
-- nothing shared the split never inserts anything.
DROP INDEX "tags_name_key";

-- Which item should end up carrying which (owner, normalized) tag. Captured before anything is
-- modified, because step 5 empties the join table it is derived from.
CREATE TABLE "_tag_join_plan" AS
SELECT DISTINCT
    j."A"          AS item_id,
    i."userId"     AS user_id,
    lower(t."name") AS normalized
FROM "_ItemTags" j
JOIN "items" i ON i."id" = j."A"
JOIN "tags"  t ON t."id" = j."B";

-- Every (owner, normalized) row that must exist afterwards, the spelling it displays, and the id it
-- takes.
CREATE TABLE "_tag_plan" AS
WITH used AS (
    -- One row per (user, existing tag), with how many of that user's items use it. The count decides
    -- which spelling survives a collapse.
    SELECT
        i."userId"      AS user_id,
        t."id"          AS old_id,
        t."name"        AS name,
        lower(t."name") AS normalized,
        count(*)        AS uses
    FROM "_ItemTags" j
    JOIN "items" i ON i."id" = j."A"
    JOIN "tags"  t ON t."id" = j."B"
    GROUP BY 1, 2, 3, 4
),
targets AS (
    SELECT
        user_id,
        normalized,
        -- The most-used spelling wins, ties broken alphabetically so the result is deterministic
        -- rather than dependent on scan order.
        (array_agg(name   ORDER BY uses DESC, name))[1] AS display,
        (array_agg(old_id ORDER BY uses DESC, name))[1] AS preferred_old_id
    FROM used
    GROUP BY user_id, normalized
),
claimed AS (
    -- An existing row can only be kept by one target: a tag two users shared is the preferred row
    -- for both of them, and only the first claimant may reuse its id.
    SELECT
        targets.*,
        row_number() OVER (PARTITION BY preferred_old_id ORDER BY user_id) AS claim_rank
    FROM targets
)
SELECT
    user_id,
    normalized,
    display,
    -- Reused ids stay cuids. Rows that have to be minted here get a uuid, which is deliberate: it is
    -- honest about having been made by a migration, and nothing in the application ever reads a tag
    -- id — tags are connected by name, and now by (userId, normalized).
    CASE WHEN claim_rank = 1 THEN preferred_old_id ELSE gen_random_uuid()::text END AS tag_id,
    CASE WHEN claim_rank = 1 THEN preferred_old_id ELSE NULL END                    AS reused_old_id
FROM claimed;

-- Rows that keep their id take their owner, their normalized form, and the winning spelling.
UPDATE "tags" t
SET "userId"     = p.user_id,
    "normalized" = p.normalized,
    "name"       = p.display
FROM "_tag_plan" p
WHERE p.reused_old_id = t."id";

-- Rows that had to be created: the second and later owners of a formerly shared tag.
INSERT INTO "tags" ("id", "name", "normalized", "userId")
SELECT p.tag_id, p.display, p.normalized, p.user_id
FROM "_tag_plan" p
WHERE p.reused_old_id IS NULL;

-- Rebuild the join so every item points at its own user's row. Rebuilt rather than repointed: an
-- item that carried both `react` and `React` collapses to a single pair here, where an in-place
-- UPDATE would try to write the same (A, B) twice.
DELETE FROM "_ItemTags";

INSERT INTO "_ItemTags" ("A", "B")
SELECT jp.item_id, p.tag_id
FROM "_tag_join_plan" jp
JOIN "_tag_plan" p
  ON p.user_id = jp.user_id
 AND p.normalized = jp.normalized;

-- Whatever is still unowned was attached to no item at all. A tag is only ever reached through an
-- item, so these are unreachable rows left behind by `deleteItem`, which does not clean up tags.
-- There is no user to assign them to and nothing that could ever display them.
DELETE FROM "tags" WHERE "userId" IS NULL;

DROP TABLE "_tag_plan";
DROP TABLE "_tag_join_plan";

-- Lock it in.
ALTER TABLE "tags" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "tags" ALTER COLUMN "normalized" SET NOT NULL;

CREATE UNIQUE INDEX "tags_userId_normalized_key" ON "tags"("userId", "normalized");
CREATE INDEX "tags_userId_idx" ON "tags"("userId");

ALTER TABLE "tags"
    ADD CONSTRAINT "tags_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
