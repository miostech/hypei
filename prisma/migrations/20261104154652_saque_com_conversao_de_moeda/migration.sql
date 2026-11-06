-- AlterEnum
ALTER TYPE "LedgerAccount" ADD VALUE 'FX_CONVERSION';

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "exchangeRate" BIGINT,
ADD COLUMN     "exchangeRateSource" TEXT,
ADD COLUMN     "sourceAmount" BIGINT,
ADD COLUMN     "sourceCurrency" CHAR(3);
