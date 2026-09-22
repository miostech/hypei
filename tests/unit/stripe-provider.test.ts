import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { StripePaymentProvider } from "@/lib/providers/payment/stripe/stripe-payment-provider";

const WEBHOOK_SECRET = "whsec_test_secret";

function fakeStripe(overrides: Record<string, unknown> = {}) {
  return {
    paymentIntents: {
      create: vi.fn(async (params: Record<string, unknown>) => ({ id: "pi_123", client_secret: "pi_123_secret_abc", status: "requires_payment_method", ...params })),
      retrieve: vi.fn(),
    },
    ...overrides,
  } as unknown as Stripe;
}

describe("StripePaymentProvider", () => {
  it("creates a PaymentIntent with minor units, metadata and a stable idempotency key", async () => {
    const stripe = fakeStripe();
    const provider = new StripePaymentProvider(stripe, WEBHOOK_SECRET);
    const result = await provider.createPayment({
      amount: 10_000n,
      currency: "BRL",
      paymentMethods: ["CREDIT_CARD", "PIX"],
      description: "Curso",
      metadata: { organizationId: "org_1", orderId: "ord_1", paymentId: "pay_1", customerId: "cus_1", offerId: "off_1" },
      idempotencyKey: "payment:pay_1",
    });
    expect(result).toEqual({ providerPaymentId: "pi_123", clientSecret: "pi_123_secret_abc", status: "requires_payment_method" });
    const [params, options] = (stripe.paymentIntents.create as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(params).toMatchObject({
      amount: 10_000,
      currency: "brl",
      payment_method_types: ["card", "pix"],
      metadata: { organizationId: "org_1", paymentId: "pay_1" },
    });
    expect(options).toEqual({ idempotencyKey: "payment:pay_1" });
  });

  it("verifies the Stripe-Signature over the raw body", async () => {
    const stripe = new Stripe("sk_test_dummy");
    const provider = new StripePaymentProvider(stripe, WEBHOOK_SECRET);
    const payload = JSON.stringify({ id: "evt_1", object: "event", type: "payment_intent.created", created: 1_700_000_000, data: { object: { id: "pi_1" } } });
    const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret: WEBHOOK_SECRET });

    const verified = await provider.verifyWebhook(payload, new Headers({ "stripe-signature": header }));
    expect(verified).toMatchObject({ provider: "STRIPE", eventId: "evt_1", eventType: "payment_intent.created" });

    await expect(provider.verifyWebhook(payload.replace("pi_1", "pi_2"), new Headers({ "stripe-signature": header }))).rejects.toMatchObject({
      code: "WEBHOOK_SIGNATURE_INVALID",
    });
    await expect(provider.verifyWebhook(payload, new Headers())).rejects.toMatchObject({ code: "WEBHOOK_SIGNATURE_INVALID" });
  });

  it("normalizes payment_intent.succeeded using the real processor fee from the balance transaction", async () => {
    const stripe = fakeStripe();
    (stripe.paymentIntents.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pi_9",
      amount_received: 10_000,
      currency: "brl",
      latest_charge: {
        id: "ch_9",
        payment_method_details: { type: "card", card: { wallet: null } },
        balance_transaction: { fee: 400, currency: "brl" },
      },
    });
    const provider = new StripePaymentProvider(stripe, WEBHOOK_SECRET);
    const [event] = await provider.processWebhook({
      provider: "STRIPE",
      eventId: "evt_9",
      eventType: "payment_intent.succeeded",
      createdAt: new Date(),
      payload: { id: "evt_9", type: "payment_intent.succeeded", data: { object: { id: "pi_9" } } },
    });
    expect(event).toMatchObject({ kind: "payment.succeeded", providerPaymentId: "pi_9", amount: 10_000n, processorFeeAmount: 400n, currency: "BRL", paymentMethod: "CREDIT_CARD" });
  });

  it("maps account.updated into a merchant snapshot", async () => {
    const provider = new StripePaymentProvider(fakeStripe(), WEBHOOK_SECRET);
    const [event] = await provider.processWebhook({
      provider: "STRIPE",
      eventId: "evt_acc",
      eventType: "account.updated",
      createdAt: new Date(),
      payload: {
        type: "account.updated",
        data: {
          object: {
            id: "acct_1",
            country: "BR",
            default_currency: "brl",
            charges_enabled: true,
            payouts_enabled: false,
            details_submitted: true,
            requirements: { currently_due: ["external_account"], past_due: [], pending_verification: [], disabled_reason: null },
          },
        },
      },
    });
    expect(event).toMatchObject({ kind: "merchant_account.updated", snapshot: { providerAccountId: "acct_1", payoutsEnabled: false, requirements: { currentlyDue: ["external_account"] } } });
  });
});
