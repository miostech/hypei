-- CreateEnum
CREATE TYPE "PixKeyType" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP');

-- AlterTable
ALTER TABLE "PayoutDestination" ADD COLUMN     "pixKey" TEXT,
ADD COLUMN     "pixKeyType" "PixKeyType",
ALTER COLUMN "providerDestinationId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PayoutDestination_organizationId_type_key" ON "PayoutDestination"("organizationId", "type");
