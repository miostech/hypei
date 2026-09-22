import type { DbClient } from "@/lib/database/postgres/client";
import type { PaymentProviderType, Prisma, Subscription } from "@/generated/prisma/client";

export interface SubscriptionRepository {
  updateByProviderId(provider: PaymentProviderType, providerSubscriptionId: string, data: Prisma.SubscriptionUpdateManyMutationInput): Promise<number>;
  list(organizationId: string): Promise<Subscription[]>;
}

export class PrismaSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly db: DbClient) {}

  async updateByProviderId(provider: PaymentProviderType, providerSubscriptionId: string, data: Prisma.SubscriptionUpdateManyMutationInput) {
    const result = await this.db.subscription.updateMany({ where: { provider, providerSubscriptionId }, data });
    return result.count;
  }

  list(organizationId: string) {
    return this.db.subscription.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } });
  }
}
