import type Stripe from "stripe";
import type { CreateMerchantAccountInput, MerchantAccountSnapshot, MerchantOnboardingLinkInput } from "../types";
import { deriveMerchantAccountStatus, isMerchantAccountReadyForPayouts } from "../merchant-status";
import { toMerchantSnapshot } from "./stripe-mappers";

/**
 * Stripe Connect specifics (connected accounts + hosted onboarding).
 * Hypei never collects bank details or identity documents itself: Stripe-hosted onboarding does.
 */
export class StripeConnectService {
  constructor(private readonly stripe: Stripe) {}

  async createConnectedAccount(input: CreateMerchantAccountInput): Promise<MerchantAccountSnapshot> {
    const account = await this.stripe.accounts.create(
      {
        country: input.country,
        email: input.email,
        default_currency: input.defaultCurrency.toLowerCase(),
        business_type: input.businessType === "COMPANY" ? "company" : "individual",
        controller: {
          fees: { payer: "application" },
          losses: { payments: "application" },
          stripe_dashboard: { type: "express" },
          requirement_collection: "stripe",
        },
        capabilities: { transfers: { requested: true } },
        // Hypei decides WHEN funds leave (internal settlement), so payouts are manual.
        settings: { payouts: { schedule: { interval: "manual" } } },
        metadata: { organizationId: input.organizationId },
      },
      { idempotencyKey: input.idempotencyKey },
    );
    return toMerchantSnapshot(account);
  }

  async createAccountOnboardingLink(input: MerchantOnboardingLinkInput) {
    const link = await this.stripe.accountLinks.create({
      account: input.providerAccountId,
      refresh_url: input.refreshUrl,
      return_url: input.returnUrl,
      type: input.mode === "update" ? "account_update" : "account_onboarding",
    });
    return { url: link.url, expiresAt: new Date(link.expires_at * 1000) };
  }

  createAccountUpdateLink(input: Omit<MerchantOnboardingLinkInput, "mode">) {
    return this.createAccountOnboardingLink({ ...input, mode: "update" });
  }

  async getConnectedAccount(providerAccountId: string): Promise<MerchantAccountSnapshot> {
    return toMerchantSnapshot(await this.stripe.accounts.retrieve(providerAccountId));
  }

  /** Pull-based sync, used by reconciliation when a webhook may have been missed. */
  async syncConnectedAccount(providerAccountId: string) {
    const snapshot = await this.getConnectedAccount(providerAccountId);
    return { snapshot, status: deriveMerchantAccountStatus(snapshot) };
  }

  isAccountReady(snapshot: MerchantAccountSnapshot): boolean {
    return isMerchantAccountReadyForPayouts({ status: deriveMerchantAccountStatus(snapshot), payoutsEnabled: snapshot.payoutsEnabled });
  }
}
