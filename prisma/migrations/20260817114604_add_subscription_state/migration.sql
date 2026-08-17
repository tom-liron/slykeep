-- AlterTable
ALTER TABLE "users" ADD COLUMN     "stripeCurrentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "stripePriceId" TEXT;
