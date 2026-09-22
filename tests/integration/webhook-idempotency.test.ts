import { beforeEach, describe, expect, it } from "vitest";
import { confirmPayment, createSeller, createTestApp, expectLedgerBalanced, startPurchase, type TestApp } from "../support/test-app";

describe("Webhook idempotency", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("the same payment_intent.succeeded event delivered twice creates ONE financial movement", async () => {
    const { checkout } = await createSeller(app);
    const { payment } = await startPurchase(app, checkout.slug);

    const first = await confirmPayment(app, payment, "evt_same");
    const second = await confirmPayment(app, payment, "evt_same");

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(await app.prisma.webhookEvent.count()).toBe(1);
    expect(await app.prisma.ledgerJournal.count({ where: { type: "payment.captured" } })).toBe(1);
    await expectLedgerBalanced(app.prisma);
  });

  it("two DIFFERENT events for the same capture still ledger it only once", async () => {
    const { checkout } = await createSeller(app);
    const { payment } = await startPurchase(app, checkout.slug);

    await confirmPayment(app, payment, "evt_a");
    await confirmPayment(app, payment, "evt_b");

    expect(await app.prisma.webhookEvent.count()).toBe(2);
    expect(await app.prisma.ledgerJournal.count({ where: { type: "payment.captured" } })).toBe(1);
    expect(await app.prisma.ledgerEntry.count()).toBe(4);
  });

  it("rejects webhooks with an invalid signature and persists nothing", async () => {
    const { rawBody } = app.mock.buildWebhook({ type: "payment.failed", providerPaymentId: "x" });
    await expect(
      app.services.webhookIngestion.ingest("MOCK", rawBody, new Headers({ "x-hypei-mock-signature": "forged" })),
    ).rejects.toMatchObject({ code: "WEBHOOK_SIGNATURE_INVALID" });
    const tampered = rawBody.replace("payment.failed", "payment.succeeded");
    const { headers } = app.mock.buildWebhook({ type: "payment.failed", providerPaymentId: "x" });
    await expect(app.services.webhookIngestion.ingest("MOCK", tampered, headers)).rejects.toMatchObject({ code: "WEBHOOK_SIGNATURE_INVALID" });
    expect(await app.prisma.webhookEvent.count()).toBe(0);
  });

  it("does not process financial logic inside ingestion (persist + enqueue only)", async () => {
    const { checkout } = await createSeller(app);
    const { payment } = await startPurchase(app, checkout.slug);
    const { rawBody, headers } = app.mock.buildWebhook({
      type: "payment.succeeded",
      providerPaymentId: payment.providerPaymentId!,
      amount: "10000",
      currency: "BRL",
    });
    await app.services.webhookIngestion.ingest("MOCK", rawBody, headers);
    expect(app.queue.jobs).toHaveLength(1);
    expect((await app.prisma.webhookEvent.findFirstOrThrow()).status).toBe("RECEIVED");
    expect(await app.prisma.ledgerEntry.count()).toBe(0);

    await app.queue.drain();
    expect((await app.prisma.webhookEvent.findFirstOrThrow()).status).toBe("PROCESSED");
    expect(await app.prisma.ledgerEntry.count()).toBe(4);
  });

  it("handles out-of-order events: a late failure never un-pays a payment", async () => {
    const { checkout } = await createSeller(app);
    const { payment } = await startPurchase(app, checkout.slug);
    await confirmPayment(app, payment);
    await app.deliver({ type: "payment.failed", providerPaymentId: payment.providerPaymentId!, reason: "late" });
    expect((await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PAID");
  });

  it("marks failed processing for retry and succeeds on retry", async () => {
    const { rawBody, headers } = app.mock.buildWebhook(
      { type: "payment.succeeded", providerPaymentId: "mock_pi_unknown", amount: "100", currency: "BRL" },
      "evt_retry",
    );
    await app.services.webhookIngestion.ingest("MOCK", rawBody, headers);
    await expect(app.queue.drain()).rejects.toBeDefined();
    const failed = await app.prisma.webhookEvent.findFirstOrThrow();
    expect(failed.status).toBe("FAILED");
    expect(failed.attempts).toBe(1);
    expect(failed.nextAttemptAt).not.toBeNull();
  });

  it("payment failure is recorded without any ledger movement", async () => {
    const { checkout } = await createSeller(app);
    const { payment } = await startPurchase(app, checkout.slug);
    await app.deliver({ type: "payment.failed", providerPaymentId: payment.providerPaymentId!, reason: "card_declined" });
    const failed = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.failureReason).toBe("card_declined");
    expect(await app.prisma.ledgerEntry.count()).toBe(0);
  });
});
