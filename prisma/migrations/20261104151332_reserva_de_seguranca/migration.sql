-- AlterTable
ALTER TABLE "Reserve" ADD COLUMN     "consumedAmount" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ReservePolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "country" CHAR(2),
    "currency" CHAR(3),
    "percentageBps" INTEGER NOT NULL DEFAULT 0,
    "holdDays" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservePolicy_organizationId_currency_idx" ON "ReservePolicy"("organizationId", "currency");

-- CreateIndex
CREATE INDEX "Reserve_status_releaseAt_idx" ON "Reserve"("status", "releaseAt");

-- CreateIndex
CREATE INDEX "Reserve_referenceId_idx" ON "Reserve"("referenceId");

-- AddForeignKey
ALTER TABLE "ReservePolicy" ADD CONSTRAINT "ReservePolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
