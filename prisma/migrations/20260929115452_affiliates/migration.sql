-- AlterEnum
ALTER TYPE "LedgerAccount" ADD VALUE 'AFFILIATE_PAYABLE';

-- AlterTable
ALTER TABLE "Affiliate" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AffiliateCommission" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "reversedAmount" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AffiliateLink" ADD COLUMN     "clicks" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "affiliateId" TEXT,
ADD COLUMN     "affiliateLinkId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "affiliateCommissionAmount" BIGINT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateLink" ADD CONSTRAINT "AffiliateLink_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "Checkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
