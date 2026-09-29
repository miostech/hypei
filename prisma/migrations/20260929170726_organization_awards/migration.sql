-- CreateEnum
CREATE TYPE "AwardTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'EMERALD', 'DIAMOND', 'ONYX');

-- CreateEnum
CREATE TYPE "AwardStatus" AS ENUM ('ACHIEVED', 'SHIPPED', 'DELIVERED');

-- CreateTable
CREATE TABLE "OrganizationAward" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tier" "AwardTier" NOT NULL,
    "threshold" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AwardStatus" NOT NULL DEFAULT 'ACHIEVED',
    "trackingCode" TEXT,
    "shippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationAward_status_achievedAt_idx" ON "OrganizationAward"("status", "achievedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationAward_organizationId_tier_key" ON "OrganizationAward"("organizationId", "tier");

-- AddForeignKey
ALTER TABLE "OrganizationAward" ADD CONSTRAINT "OrganizationAward_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
