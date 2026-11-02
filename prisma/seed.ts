import "dotenv/config";
import { createPrismaClient } from "../src/lib/database/postgres/client";
import { PUBLISHED_PLATFORM_FEE } from "../src/modules/fees/fee.calculator";

/**
 * Seeds the financial POLICIES the platform needs to operate.
 *
 * O prazo de settlement ainda é placeholder de desenvolvimento. A taxa não é mais: ela sai de
 * PUBLISHED_PLATFORM_FEE, a mesma constante que a landing page anuncia, para que o que o
 * produtor lê na página e o que o ledger cobra não possam divergir.
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

  // A taxa anunciada, por moeda. O fixo é em unidades menores da moeda da venda.
  for (const currency of ["BRL", "EUR", "USD"]) {
    const existing = await prisma.platformFeePolicy.findFirst({ where: { organizationId: null, country: null, currency } });
    const data = { currency, ...PUBLISHED_PLATFORM_FEE, active: true };
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
