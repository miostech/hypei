-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('SENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "storageBytes" INTEGER,
ADD COLUMN     "storageFilename" TEXT,
ADD COLUMN     "storageType" TEXT;

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "eventId" TEXT,
    "template" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'SENDING',
    "providerId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailDelivery_organizationId_createdAt_idx" ON "EmailDelivery"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDelivery_eventId_template_recipient_key" ON "EmailDelivery"("eventId", "template", "recipient");

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
