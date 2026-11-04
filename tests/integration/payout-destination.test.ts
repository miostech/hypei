import { beforeEach, describe, expect, it } from "vitest";
import { confirmPayment, createSeller, createTestApp, startPurchase, VALID_CPF, type TestApp } from "../support/test-app";

/**
 * Onde o dinheiro do saque cai. No Brasil quem paga é a Kabrun, por Pix, e a chave é condição
 * do saque: sem ela o valor sai do saldo e não chega em lugar nenhum.
 */
describe("Destino do saque", () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });

  /** Uma produtora com 8600 disponíveis, pronta para sacar. */
  async function sellerWithAvailable() {
    const seller = await createSeller(app, { amount: 10_000n });
    const { payment } = await startPurchase(app, seller.checkout.slug);
    await confirmPayment(app, payment);
    app.clock.advanceDays(8);
    await app.services.settlements.releaseDue({ now: app.clock.now });
    return seller;
  }

  it("guarda a chave normalizada e devolve mascarada", async () => {
    const seller = await createSeller(app);

    const saved = await app.services.payoutDestinations.savePix({
      organizationId: seller.organization.id,
      country: "BR",
      currency: "BRL",
      rawKey: "  CA@Kabrun.DEV ",
    });

    expect(saved).toMatchObject({ pixKeyType: "EMAIL", pixKey: "ca@kabrun.dev", masked: "ca•@kabrun.dev" });
    expect(await app.services.payoutDestinations.getPix(seller.organization.id)).toMatchObject({ pixKey: "ca@kabrun.dev" });
  });

  it("troca a chave no lugar, em vez de guardar uma segunda", async () => {
    const seller = await createSeller(app);

    await app.services.payoutDestinations.savePix({
      organizationId: seller.organization.id,
      country: "BR",
      currency: "BRL",
      rawKey: "ca@kabrun.dev",
    });
    await app.services.payoutDestinations.savePix({
      organizationId: seller.organization.id,
      country: "BR",
      currency: "BRL",
      rawKey: "(11) 99999-9999",
    });

    const rows = await app.prisma.payoutDestination.findMany({ where: { organizationId: seller.organization.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ pixKeyType: "PHONE", pixKey: "+5511999999999" });
  });

  it("aceita a chave de documento quando é o documento da própria conta", async () => {
    const seller = await createSeller(app);

    const saved = await app.services.payoutDestinations.savePix({
      organizationId: seller.organization.id,
      country: "BR",
      currency: "BRL",
      rawKey: VALID_CPF,
    });

    expect(saved.pixKeyType).toBe("CPF");
  });

  it("recusa a chave de documento de outro titular", async () => {
    const seller = await createSeller(app);

    // CPF válido, mas não é o da conta: Pix cai na conta de quem é dono da chave, e não volta.
    await expect(
      app.services.payoutDestinations.savePix({
        organizationId: seller.organization.id,
        country: "BR",
        currency: "BRL",
        rawKey: "191.000.000-00",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("recusa chave inválida antes de ela virar um saque que falha", async () => {
    const seller = await createSeller(app);

    await expect(
      app.services.payoutDestinations.savePix({
        organizationId: seller.organization.id,
        country: "BR",
        currency: "BRL",
        rawKey: "12345678900",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("não deixa sacar sem chave cadastrada", async () => {
    const { organization } = await sellerWithAvailable();
    await app.prisma.payoutDestination.deleteMany({ where: { organizationId: organization.id } });

    await expect(
      app.services.payouts.request({ organizationId: organization.id, amount: 1_000n, currency: "BRL", idempotencyKey: "sem-chave" }),
    ).rejects.toMatchObject({ code: "PAYOUT_NOT_ALLOWED" });
    expect(await app.prisma.payout.count()).toBe(0);
  });

  it("manda para o provedor a chave que estava valendo quando o saque foi pedido", async () => {
    const { organization } = await sellerWithAvailable();
    const payout = await app.services.payouts.request({
      organizationId: organization.id,
      amount: 5_000n,
      currency: "BRL",
      idempotencyKey: "com-chave",
    });

    // Trocar a chave depois não muda para onde este dinheiro foi: o destino fica congelado.
    await app.services.payoutDestinations.savePix({
      organizationId: organization.id,
      country: "BR",
      currency: "BRL",
      rawKey: "outra@kabrun.dev",
    });

    expect(payout.destinationId).not.toBeNull();
    expect(app.mock.payoutDestination(payout.providerPayoutId!)).toEqual({
      type: "PIX",
      keyType: "CPF",
      key: VALID_CPF.replace(/\D/g, ""),
    });
  });
});
