import type { DbClient } from "@/lib/database/postgres/client";
import type { Customer, PaymentProviderType } from "@/generated/prisma/client";

export type CustomerWithStats = Customer & { _count: { orders: number } };

export interface CustomerRepository {
  upsertByEmail(organizationId: string, input: { name: string; email: string; phone?: string | null; country?: string | null }): Promise<Customer>;
  list(organizationId: string, options: { search?: string; limit: number }): Promise<CustomerWithStats[]>;
  findById(organizationId: string, id: string): Promise<Customer | null>;
  findProviderCustomerId(customerId: string, provider: PaymentProviderType): Promise<string | null>;
  linkProviderCustomer(customerId: string, provider: PaymentProviderType, providerCustomerId: string): Promise<void>;
}

export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly db: DbClient) {}

  upsertByEmail(organizationId: string, input: { name: string; email: string; phone?: string | null; country?: string | null }) {
    const email = input.email.trim().toLowerCase();
    return this.db.customer.upsert({
      where: { organizationId_email: { organizationId, email } },
      create: { organizationId, email, name: input.name, phone: input.phone ?? null, country: input.country ?? null },
      update: { name: input.name, ...(input.phone ? { phone: input.phone } : {}), ...(input.country ? { country: input.country } : {}) },
    });
  }

  list(organizationId: string, options: { search?: string; limit: number }) {
    const search = options.search?.trim();
    return this.db.customer.findMany({
      where: {
        organizationId,
        ...(search
          ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] }
          : {}),
      },
      include: { _count: { select: { orders: true } } },
      orderBy: { createdAt: "desc" },
      take: options.limit,
    });
  }

  findById(organizationId: string, id: string) {
    return this.db.customer.findFirst({ where: { id, organizationId } });
  }

  async findProviderCustomerId(customerId: string, provider: PaymentProviderType) {
    const link = await this.db.providerCustomer.findUnique({ where: { customerId_provider: { customerId, provider } } });
    return link?.providerCustomerId ?? null;
  }

  async linkProviderCustomer(customerId: string, provider: PaymentProviderType, providerCustomerId: string) {
    await this.db.providerCustomer.upsert({
      where: { customerId_provider: { customerId, provider } },
      create: { customerId, provider, providerCustomerId },
      update: {},
    });
  }
}
