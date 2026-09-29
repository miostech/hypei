import { beforeEach, describe, expect, it } from "vitest";
import { describeRequirements } from "@/modules/compliance/verification.requirements";
import { confirmPayment, createSeller, createTestApp, startPurchase, type TestApp } from "../support/test-app";

describe("Identity verification", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("reports a verified account as able to sell and withdraw", async () => {
    const seller = await createSeller(app);

    const overview = await app.services.verification.overview(seller.organization.id);
    expect(overview).toMatchObject({
      status: "VERIFIED",
      canSell: true,
      canWithdraw: true,
      hasAccount: true,
      businessType: "INDIVIDUAL",
      country: "BR",
    });
    expect(overview.requirements).toHaveLength(0);
    expect(overview.taxIdentities[0]).toMatchObject({ type: "CPF" });
  });

  it("shows what the provider is waiting for, in the producer's words", async () => {
    const seller = await createSeller(app);
    await app.prisma.merchantAccount.updateMany({
      where: { organizationId: seller.organization.id },
      data: {
        status: "REQUIRES_ACTION",
        chargesEnabled: false,
        payoutsEnabled: false,
        requirementsDue: ["individual.verification.document", "external_account", "individual.dob.day", "individual.dob.year"],
      },
    });

    const overview = await app.services.verification.overview(seller.organization.id);
    expect(overview).toMatchObject({ canSell: false, canWithdraw: false });
    expect(overview.requirements.map((requirement) => requirement.label)).toEqual([
      "Documento de identidade",
      "Conta bancária para receber",
      // day/month/year collapse into one line.
      "Data de nascimento do titular",
    ]);
    expect(overview.requirements[0].hint).toContain("RG ou CNH");
  });

  it("keeps an unknown requirement code visible instead of hiding it", () => {
    const requirements = describeRequirements(["company.something_new", "external_account"]);
    expect(requirements.map((requirement) => requirement.label)).toEqual(["company.something_new", "Conta bancária para receber"]);
  });

  it("blocks payouts while the account is not cleared for them", async () => {
    const seller = await createSeller(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "comprador@example.com");
    await confirmPayment(app, payment);
    app.clock.advanceDays(10);
    await app.services.settlements.releaseDue({ now: app.clock.now });

    await app.prisma.merchantAccount.updateMany({
      where: { organizationId: seller.organization.id },
      data: { status: "REQUIRES_ACTION", payoutsEnabled: false, requirementsDue: ["external_account"] },
    });

    await expect(
      app.services.payouts.request({
        organizationId: seller.organization.id,
        amount: 5000n,
        currency: "BRL",
        idempotencyKey: "payout-sem-verificacao",
      }),
    ).rejects.toMatchObject({ code: "PAYOUT_NOT_ALLOWED" });
  });

  it("records that the verification was opened and keeps a verified status verified", async () => {
    const seller = await createSeller(app);
    const org = seller.organization.id;

    await app.services.verification.startVerification(org, seller.user.id, "https://app.ripay.test");

    const verification = await app.prisma.organizationVerification.findFirstOrThrow({ where: { organizationId: org } });
    expect(verification.submittedAt).not.toBeNull();
    expect(verification.providerVerificationId).not.toBeNull();
    // Reopening the form to review data must not undo an approval.
    expect(verification.status).toBe("VERIFIED");

    const audit = await app.prisma.auditLog.findFirst({ where: { organizationId: org, action: "verification.started" } });
    expect(audit).not.toBeNull();
  });

  it("creates the record for an organization that never had one", async () => {
    const seller = await createSeller(app);
    await app.prisma.organizationVerification.deleteMany({ where: { organizationId: seller.organization.id } });

    expect((await app.services.verification.overview(seller.organization.id)).status).toBe("NOT_STARTED");

    await app.services.verification.startVerification(seller.organization.id, seller.user.id, "https://app.ripay.test");
    expect(await app.prisma.organizationVerification.count({ where: { organizationId: seller.organization.id } })).toBe(1);
  });

  it("never reports another organization's verification", async () => {
    const a = await createSeller(app, { slug: "org-a" });
    const b = await createSeller(app, { slug: "org-b" });
    await app.prisma.merchantAccount.updateMany({
      where: { organizationId: b.organization.id },
      data: { payoutsEnabled: false, requirementsDue: ["external_account"] },
    });

    expect((await app.services.verification.overview(a.organization.id)).canWithdraw).toBe(true);
    expect((await app.services.verification.overview(b.organization.id)).canWithdraw).toBe(false);
  });
});
