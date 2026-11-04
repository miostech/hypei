import "dotenv/config";
import { createPrismaClient } from "../src/lib/database/postgres/client";
import { PUBLISHED_PLATFORM_FEE } from "../src/modules/fees/fee.calculator";
import { CARD_SETTLEMENT_DAYS, INSTANT_SETTLEMENT_DAYS } from "../src/modules/balances/settlement-terms";

/**
 * Seeds the financial POLICIES the platform needs to operate.
 *
 * Taxa e prazo são os dois números que o produtor lê em "Taxas e prazos" antes de vender, e
 * saem daqui: a taxa de PUBLISHED_PLATFORM_FEE, a mesma constante que a landing page anuncia,
 * e o prazo por meio de pagamento — cartão compensa devagar, Pix e boleto caem em dois dias.
 */
async function main() {
  const prisma = createPrismaClient(process.env.DATABASE_URL!);

  const EU = ["PT", "ES", "FR", "DE", "IT"];
  const settlementPolicies = [
    { country: null, currency: null, method: null, delayDays: CARD_SETTLEMENT_DAYS }, // global default
    { country: "BR", currency: "BRL", method: null, delayDays: CARD_SETTLEMENT_DAYS },
    { country: "BR", currency: "BRL", method: "PIX" as const, delayDays: INSTANT_SETTLEMENT_DAYS },
    { country: "BR", currency: "BRL", method: "BOLETO" as const, delayDays: INSTANT_SETTLEMENT_DAYS },
    ...EU.map((country) => ({ country, currency: "EUR", method: null, delayDays: CARD_SETTLEMENT_DAYS })),
    { country: "US", currency: "USD", method: null, delayDays: CARD_SETTLEMENT_DAYS },
  ];

  for (const policy of settlementPolicies) {
    const existing = await prisma.settlementPolicy.findFirst({
      where: { organizationId: null, country: policy.country, currency: policy.currency, method: policy.method },
    });
    if (existing) await prisma.settlementPolicy.update({ where: { id: existing.id }, data: { delayDays: policy.delayDays, active: true } });
    else await prisma.settlementPolicy.create({ data: policy });
  }

  // A taxa anunciada, por moeda: o Brasil tem uma condição, a venda lá fora tem outra.
  for (const [currency, rule] of Object.entries(PUBLISHED_PLATFORM_FEE)) {
    const existing = await prisma.platformFeePolicy.findFirst({ where: { organizationId: null, country: null, currency } });
    const data = { currency, ...rule, active: true };
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
