-- CreateEnum
CREATE TYPE "AffiliationStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- DropForeignKey
ALTER TABLE "AffiliateLink" DROP CONSTRAINT "AffiliateLink_affiliateId_fkey";

-- DropForeignKey
ALTER TABLE "AffiliateLink" DROP CONSTRAINT "AffiliateLink_checkoutId_fkey";

-- AlterTable
ALTER TABLE "Affiliate" ADD COLUMN     "payeeOrganizationId" TEXT,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "affiliateLinkId",
ADD COLUMN     "affiliationId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "affiliateCommissionBps" INTEGER,
ADD COLUMN     "affiliateInviteCode" TEXT,
ADD COLUMN     "affiliationEnabled" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "AffiliateLink";

-- CreateTable
CREATE TABLE "Affiliation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "status" "AffiliationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Affiliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Affiliation_code_key" ON "Affiliation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliation_productId_affiliateId_key" ON "Affiliation"("productId", "affiliateId");

-- CreateIndex
CREATE INDEX "Affiliate_userId_idx" ON "Affiliate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_affiliateInviteCode_key" ON "Product"("affiliateInviteCode");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_affiliationId_fkey" FOREIGN KEY ("affiliationId") REFERENCES "Affiliation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_payeeOrganizationId_fkey" FOREIGN KEY ("payeeOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliation" ADD CONSTRAINT "Affiliation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliation" ADD CONSTRAINT "Affiliation_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

