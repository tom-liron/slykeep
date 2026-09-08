/*
  Warnings:

  - You are about to drop the column `deletionWarningSentAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `readOnlyReminderSentAt` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "deletionWarningSentAt",
DROP COLUMN "readOnlyReminderSentAt";
