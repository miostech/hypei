import type { DbClient } from "@/lib/database/postgres/client";
import type { Dispute, Prisma } from "@/generated/prisma/client";

export type DisputeListItem = Dispute & {
  payment: { id: string; orderId: string; customer: { name: string; email: string }; order: { items: { productName: string }[] } };
};

export interface DisputeRepository {
  listForOrganization(organizationId: string, limit: number): Promise<DisputeListItem[]>;
  findByProviderDisputeId(providerDisputeId: string): Promise<Dispute | null>;
  create(input: Prisma.DisputeUncheckedCreateInput): Promise<Dispute>;
  lock(id: string): Promise<Dispute>;
  update(id: string, data: Prisma.DisputeUncheckedUpdateInput): Promise<Dispute>;
  listOpen(organizationId: string): Promise<Dispute[]>;
}

export class PrismaDisputeRepository implements DisputeRepository {
  constructor(private readonly db: DbClient) {}

  listForOrganization(organizationId: string, limit: number) {
    return this.db.dispute.findMany({
      where: { organizationId },
      include: {
        payment: {
          select: {
            id: true,
            orderId: true,
            customer: { select: { name: true, email: true } },
            order: { select: { items: { select: { productName: true }, take: 1 } } },
          },
        },
      },
      // Open disputes first: they are the ones with a deadline.
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: limit,
    });
  }

  findByProviderDisputeId(providerDisputeId: string) {
    return this.db.dispute.findUnique({ where: { providerDisputeId } });
  }

  create(input: Prisma.DisputeUncheckedCreateInput) {
    return this.db.dispute.create({ data: input });
  }

  async lock(id: string) {
    await this.db.$queryRaw`SELECT id FROM "Dispute" WHERE id = ${id} FOR UPDATE`;
    return this.db.dispute.findUniqueOrThrow({ where: { id } });
  }

  update(id: string, data: Prisma.DisputeUncheckedUpdateInput) {
    return this.db.dispute.update({ where: { id }, data });
  }

  listOpen(organizationId: string) {
    return this.db.dispute.findMany({
      where: { organizationId, status: { in: ["OPEN", "UNDER_REVIEW"] } },
      orderBy: { createdAt: "desc" },
    });
  }
}
