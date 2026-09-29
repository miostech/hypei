import type { DbClient } from "@/lib/database/postgres/client";
import type { Customer, Offer, PaymentProviderType, Prisma, Subscription } from "@/generated/prisma/client";

export type SubscriptionListItem = Subscription & {
  customer: Pick<Customer, "id" | "name" | "email">;
  offer: Pick<Offer, "id" | "name" | "billingInterval"> & { product: { name: string } };
  _count: { payments: number };
};

export interface SubscriptionRepository {
  create(input: Prisma.SubscriptionUncheckedCreateInput): Promise<Subscription>;
  update(id: string, data: Prisma.SubscriptionUncheckedUpdateInput): Promise<Subscription>;
  updateByProviderId(provider: PaymentProviderType, providerSubscriptionId: string, data: Prisma.SubscriptionUpdateManyMutationInput): Promise<number>;
  findByProviderId(provider: PaymentProviderType, providerSubscriptionId: string): Promise<Subscription | null>;
  findForOrganization(organizationId: string, id: string): Promise<Subscription | null>;
  list(organizationId: string): Promise<SubscriptionListItem[]>;
  /** Active subscriptions of a customer for a given product, used to keep access in step. */
  activeForCustomer(customerId: string): Promise<Subscription[]>;
}

const LIST_INCLUDE = {
  customer: { select: { id: true, name: true, email: true } },
  offer: { select: { id: true, name: true, billingInterval: true, product: { select: { name: true } } } },
  _count: { select: { payments: true } },
} as const;

export class PrismaSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly db: DbClient) {}

  create(input: Prisma.SubscriptionUncheckedCreateInput) {
    return this.db.subscription.create({ data: input });
  }

  update(id: string, data: Prisma.SubscriptionUncheckedUpdateInput) {
    return this.db.subscription.update({ where: { id }, data });
  }

  async updateByProviderId(provider: PaymentProviderType, providerSubscriptionId: string, data: Prisma.SubscriptionUpdateManyMutationInput) {
    const result = await this.db.subscription.updateMany({ where: { provider, providerSubscriptionId }, data });
    return result.count;
  }

  findByProviderId(provider: PaymentProviderType, providerSubscriptionId: string) {
    return this.db.subscription.findFirst({ where: { provider, providerSubscriptionId } });
  }

  findForOrganization(organizationId: string, id: string) {
    return this.db.subscription.findFirst({ where: { id, organizationId } });
  }

  list(organizationId: string) {
    return this.db.subscription.findMany({
      where: { organizationId },
      include: LIST_INCLUDE,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  }

  activeForCustomer(customerId: string) {
    return this.db.subscription.findMany({ where: { customerId, status: { in: ["ACTIVE", "TRIALING"] } } });
  }
}
