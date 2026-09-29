-- AlterEnum
ALTER TYPE "OutboxStatus" ADD VALUE 'PUBLISHING';

-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "claimedAt" TIMESTAMP(3);
