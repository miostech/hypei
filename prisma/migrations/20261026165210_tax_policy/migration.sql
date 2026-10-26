-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('NONE', 'BR_SIMPLES_NACIONAL', 'BR_ISS');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "taxRegime" "TaxRegime" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "TaxPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "country" CHAR(2),
    "regime" "TaxRegime" NOT NULL DEFAULT 'NONE',
    "rateBps" INTEGER NOT NULL DEFAULT 0,
    "jurisdiction" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxPolicy_organizationId_idx" ON "TaxPolicy"("organizationId");

-- CreateIndex
CREATE INDEX "TaxPolicy_country_idx" ON "TaxPolicy"("country");

-- AddForeignKey
ALTER TABLE "TaxPolicy" ADD CONSTRAINT "TaxPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
