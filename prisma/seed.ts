import "dotenv/config";
import { createPrismaClient } from "../src/lib/database/postgres/client";

/**
 * Seeds the financial POLICIES the platform needs to operate.
 * Values here are placeholders for development — Hypei's real pricing is not defined yet.
 */
async function main() {
  const prisma = createPrismaClient(process.env.DATABASE_URL!);

  const settlementPolicies = [
    { country: null, currency: null, delayDays: 14 }, // global default
    { country: "BR", currency: "BRL", delayDays: 14 },
    { country: "PT", currency: "EUR", delayDays: 7 },
    { country: "ES", currency: "EUR", delayDays: 7 },
    { country: "FR", currency: "EUR", delayDays: 7 },
    { country: "DE", currency: "EUR", delayDays: 7 },
    { country: "IT", currency: "EUR", delayDays: 7 },
    { country: "US", currency: "USD", delayDays: 7 },
  ];

  for (const policy of settlementPolicies) {
    const existing = await prisma.settlementPolicy.findFirst({
      where: { organizationId: null, country: policy.country, currency: policy.currency },
    });
    if (existing) await prisma.settlementPolicy.update({ where: { id: existing.id }, data: { delayDays: policy.delayDays, active: true } });
    else await prisma.settlementPolicy.create({ data: policy });
  }

  // Placeholder platform fee: 10% + 0 fixed, per currency.
  for (const currency of ["BRL", "EUR", "USD"]) {
    const existing = await prisma.platformFeePolicy.findFirst({ where: { organizationId: null, country: null, currency } });
    const data = { currency, percentageBps: 1000, fixedAmount: 0n, active: true };
    if (existing) await prisma.platformFeePolicy.update({ where: { id: existing.id }, data });
    else await prisma.platformFeePolicy.create({ data });
  }

  const [settlements, fees] = await Promise.all([prisma.settlementPolicy.count(), prisma.platformFeePolicy.count()]);
  console.log(`✔ seed: ${settlements} settlement policies, ${fees} platform fee policies`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
