import "dotenv/config";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../src/lib/database/postgres/client";
import { MockPaymentProvider } from "../src/lib/providers/payment/mock/mock-payment-provider";
import { getServices } from "../src/server/container";

/**
 * Development-only demo data: a real organization with real sales, created through the
 * normal services (checkout → signed webhook → ledger) and then backdated so the
 * dashboard has 30 days of history. Never run this against production data.
 */
const EMAIL = process.argv[2] ?? "producer@ripay.dev";
const DAYS = 30;

const PRODUCTS = [
  { name: "Curso de Fotografia Noturna", slug: "fotografia-noturna", offer: "Acesso vitalício", price: "497,00", weight: 5 },
  { name: "Mentoria Individual 1:1", slug: "mentoria-individual", offer: "4 sessões", price: "1.997,00", weight: 1 },
  { name: "Comunidade Criadores Pro", slug: "comunidade-pro", offer: "Assinatura anual", price: "297,00", weight: 3 },
];

const BUYERS = [
  "Marina Alves", "Rafael Torres", "Beatriz Lima", "Caio Fernandes", "Helena Souza",
  "Diego Martins", "Larissa Costa", "Bruno Carvalho", "Aline Ribeiro", "Tiago Moraes",
  "Patrícia Gomes", "Vinícius Rocha", "Camila Duarte", "Eduardo Prado", "Sofia Nunes",
];

const random = (max: number) => Math.floor(Math.random() * max);

async function main() {
  if (process.env.APP_ENV === "production") throw new Error("seed:demo is disabled in production");

  const prisma = getPrisma();
  const services = getServices();
  const provider = services.paymentProvider;
  if (!(provider instanceof MockPaymentProvider)) {
    throw new Error("seed:demo só roda com PAYMENT_PROVIDER=mock (nenhum dinheiro real é movimentado)");
  }

  const user = await prisma.user.findFirst({ where: { email: EMAIL } });
  if (!user) {
    console.error(`✖ usuário ${EMAIL} não encontrado. Faça login uma vez em /api/auth/login e rode de novo.`);
    process.exit(1);
  }

  let organization = (await services.organizations.listForUser(user.id))[0]?.organization;
  if (!organization) {
    organization = await services.organizations.onboard(user, {
      name: "Estúdio Aurora",
      slug: `aurora-${randomUUID().slice(0, 4)}`,
      country: "BR",
      businessType: "INDIVIDUAL",
      currency: "BRL",
      taxIdType: "CPF",
      taxId: "529.982.247-25",
      supportEmail: EMAIL,
    });
    console.log(`✔ organização criada: ${organization.name}`);
  }

  // Catalogue ---------------------------------------------------------------
  const catalogue: { checkout: { id: string; slug: string; offerId: string }; weight: number }[] = [];
  for (const item of PRODUCTS) {
    const existing = (await services.products.list(organization.id)).find((p) => p.slug === item.slug);
    const product =
      existing ??
      (await services.products.create(organization.id, user.id, {
        name: item.name,
        slug: item.slug,
        description: "Conteúdo completo, acesso imediato após a confirmação do pagamento.",
        type: "COURSE",
        status: "ACTIVE",
      }));

    const offers = await services.offers.list(organization.id);
    const offer =
      offers.find((o) => o.productId === product.id) ??
      (await services.offers.create(organization.id, user.id, {
        productId: product.id,
        name: item.offer,
        price: item.price,
        currency: "BRL",
        billingType: "ONE_TIME",
        active: true,
      }));

    const checkouts = await services.checkouts.list(organization.id);
    const checkout =
      checkouts.find((c) => c.offerId === offer.id) ??
      (await services.checkouts.create(organization.id, user.id, {
        offerId: offer.id,
        name: item.name,
        slug: item.slug,
        headline: `Garanta seu acesso a ${item.name}`,
        description: "Pagamento seguro. Acesso liberado na hora.",
        accentColor: "#4B168C",
        logoUrl: "",
        collectPhone: false,
        guaranteeDays: 7,
        enabledPaymentMethods: [],
      }));

    catalogue.push({ checkout, weight: item.weight });
  }

  const pool = catalogue.flatMap((entry) => Array<(typeof catalogue)[number]>(entry.weight).fill(entry));

  // Member area: one published course with real modules and lessons -------
  const mainProduct = (await services.products.list(organization.id)).find((p) => p.slug === PRODUCTS[0].slug);
  if (mainProduct && !(await services.uow.repos.courses.findByProductId(mainProduct.id))) {
    const course = await services.courses.create(organization.id, user.id, {
      productId: mainProduct.id,
      title: PRODUCTS[0].name,
      slug: PRODUCTS[0].slug,
      description: "Do equipamento à edição final: tudo que você precisa para fotografar à noite.",
    });

    const curriculum = [
      {
        title: "Comece por aqui",
        lessons: [
          { title: "Boas-vindas ao curso", type: "VIDEO" as const, durationMinutes: 4 },
          { title: "Como aproveitar o curso", type: "TEXT" as const, content: "Assista na ordem dos módulos e refaça os exercícios de cada aula." },
        ],
      },
      {
        title: "Equipamento e configuração",
        lessons: [
          { title: "Câmera, lente e tripé", type: "VIDEO" as const, durationMinutes: 18 },
          { title: "ISO, abertura e velocidade à noite", type: "VIDEO" as const, durationMinutes: 26 },
          { title: "Checklist de campo", type: "PDF" as const, durationMinutes: 0 },
        ],
      },
      {
        title: "Na rua",
        lessons: [
          { title: "Luz urbana e reflexos", type: "VIDEO" as const, durationMinutes: 31 },
          { title: "Longa exposição na prática", type: "VIDEO" as const, durationMinutes: 42 },
          { title: "Encontro ao vivo: análise de fotos", type: "LIVE" as const, durationMinutes: 60 },
        ],
      },
      {
        title: "Edição",
        lessons: [
          { title: "Revelando o RAW", type: "VIDEO" as const, durationMinutes: 38 },
          { title: "Presets do curso", type: "DOWNLOAD" as const, durationMinutes: 0 },
        ],
      },
    ];

    let lessonCount = 0;
    for (const item of curriculum) {
      const courseModule = await services.courses.addModule(organization.id, course.id, item.title);
      for (const entry of item.lessons) {
        await services.courses.addLesson(organization.id, courseModule.id, {
          title: entry.title,
          type: entry.type,
          durationMinutes: entry.durationMinutes || undefined,
          content: entry.type === "TEXT" ? entry.content : "",
          externalUrl: entry.type === "TEXT" ? "" : "https://cdn.example.com/aulas/fotografia-noturna.mp4",
        });
        lessonCount++;
      }
    }
    await services.courses.setPublished(organization.id, user.id, course.id, true);
    console.log(`✔ curso publicado: ${curriculum.length} módulos, ${lessonCount} aulas`);
  }

  // Sales -------------------------------------------------------------------
  const existingOrders = await prisma.order.count({ where: { organizationId: organization.id } });
  if (existingOrders > 0) {
    console.log(`• ${existingOrders} pedidos já existem — pulando a geração de vendas`);
  } else {
    let created = 0;
    for (let day = DAYS - 1; day >= 0; day--) {
      const salesToday = day > 25 ? random(2) : random(4);
      for (let i = 0; i < salesToday; i++) {
        const entry = pool[random(pool.length)];
        const buyer = BUYERS[random(BUYERS.length)];
        const email = `${buyer.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, ".")}@example.com`;

        const started = await services.checkouts.start({
          slug: entry.checkout.slug,
          attemptId: randomUUID(),
          sessionId: randomUUID(),
          name: buyer,
          email,
          tracking: { utm_source: ["instagram", "youtube", "google", "direto"][random(4)] },
        });

        const payment = await prisma.payment.findUniqueOrThrow({ where: { id: started.paymentId } });
        // 15% of the attempts are abandoned, which keeps the funnel realistic.
        if (random(100) < 15) continue;

        const { rawBody, headers } = provider.buildWebhook({
          type: "payment.succeeded",
          providerPaymentId: payment.providerPaymentId!,
          amount: payment.amount.toString(),
          currency: payment.currency,
        });
        await services.webhookIngestion.ingest("MOCK", rawBody, headers);
        await new Promise((resolve) => setTimeout(resolve, 30)); // let the in-process queue drain

        const when = new Date(Date.now() - day * 86_400_000 - random(20) * 3_600_000);
        await backdate(prisma, started.orderId, payment.id, when);
        created++;
      }
    }
    console.log(`✔ ${created} vendas geradas nos últimos ${DAYS} dias`);
  }

  // Settlement + a payout so the finance pages have movement -----------------
  const settlement = await services.settlements.releaseDue({ organizationId: organization.id });
  console.log(`✔ settlement: ${settlement.processed} pagamento(s), ${settlement.released} liberado(s)`);

  const balance = await services.finance.summary(organization.id, "BRL");
  if (balance.available > 200_000n && (await prisma.payout.count({ where: { organizationId: organization.id } })) === 0) {
    const payout = await services.payouts.request({
      organizationId: organization.id,
      amount: balance.available / 2n,
      currency: "BRL",
      idempotencyKey: `demo-payout-${organization.id}`,
      userId: user.id,
    });
    const { rawBody, headers } = provider.buildWebhook({
      type: "payout.updated",
      providerPayoutId: payout.providerPayoutId!,
      payoutId: payout.id,
      status: "paid",
    });
    await services.webhookIngestion.ingest("MOCK", rawBody, headers);
    await new Promise((resolve) => setTimeout(resolve, 60));
    console.log(`✔ saque de demonstração: ${payout.amount}`);
  }

  const summary = await services.finance.summary(organization.id, "BRL");
  console.log(
    `\n  disponível ${summary.available} · pendente ${summary.pending} · bruto ${summary.grossRevenue} (em centavos)\n` +
      `  acesse http://localhost:3100/dashboard`,
  );
  process.exit(0);
}

/** Moves an order, its payment and its ledger rows back in time. */
async function backdate(prisma: ReturnType<typeof getPrisma>, orderId: string, paymentId: string, when: Date) {
  const settleAt = new Date(when.getTime() + 14 * 86_400_000);
  await prisma.$transaction([
    prisma.$executeRaw`UPDATE "Order" SET "createdAt" = ${when}, "updatedAt" = ${when} WHERE id = ${orderId}`,
    prisma.$executeRaw`UPDATE "Payment" SET "createdAt" = ${when}, "updatedAt" = ${when}, "paidAt" = ${when}, "settleAt" = ${settleAt} WHERE id = ${paymentId}`,
    prisma.$executeRaw`UPDATE "LedgerJournal" SET "createdAt" = ${when} WHERE "paymentId" = ${paymentId}`,
    prisma.$executeRaw`UPDATE "LedgerEntry" SET "createdAt" = ${when} WHERE "journalId" IN (SELECT id FROM "LedgerJournal" WHERE "paymentId" = ${paymentId})`,
  ]);
}

void main();
