import type { DbClient } from "@/lib/database/postgres/client";
import type { MerchantAccount, MerchantAccountStatus, PaymentProviderType } from "@/generated/prisma/client";
import type { MerchantAccountSnapshot } from "@/lib/providers/payment/types";

export interface MerchantAccountRepository {
  findByOrganization(organizationId: string, provider: PaymentProviderType): Promise<MerchantAccount | null>;
  findByProviderAccountId(provider: PaymentProviderType, providerAccountId: string): Promise<MerchantAccount | null>;
  upsertFromSnapshot(input: {
    organizationId: string;
    provider: PaymentProviderType;
    snapshot: MerchantAccountSnapshot;
    status: MerchantAccountStatus;
  }): Promise<MerchantAccount>;
}

export class PrismaMerchantAccountRepository implements MerchantAccountRepository {
  constructor(private readonly db: DbClient) {}

  findByOrganization(organizationId: string, provider: PaymentProviderType) {
    return this.db.merchantAccount.findUnique({ where: { organizationId_provider: { organizationId, provider } } });
  }

  findByProviderAccountId(provider: PaymentProviderType, providerAccountId: string) {
    return this.db.merchantAccount.findUnique({ where: { provider_providerAccountId: { provider, providerAccountId } } });
  }

  upsertFromSnapshot({ organizationId, provider, snapshot, status }: {
    organizationId: string;
    provider: PaymentProviderType;
    snapshot: MerchantAccountSnapshot;
    status: MerchantAccountStatus;
  }) {
    // Only what's needed for display/control is persisted; full payloads go to provider_snapshots (Mongo).
    const data = {
      status,
      country: snapshot.country,
      defaultCurrency: snapshot.defaultCurrency,
      chargesEnabled: snapshot.chargesEnabled,
      payoutsEnabled: snapshot.payoutsEnabled,
      detailsSubmitted: snapshot.detailsSubmitted,
      requirementsDue: [...snapshot.requirements.currentlyDue, ...snapshot.requirements.pastDue],
    };
    return this.db.merchantAccount.upsert({
      where: { provider_providerAccountId: { provider, providerAccountId: snapshot.providerAccountId } },
      create: { organizationId, provider, providerAccountId: snapshot.providerAccountId, ...data },
      update: data,
    });
  }
}
