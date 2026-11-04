import type { DbClient } from "@/lib/database/postgres/client";
import type { Reserve } from "@/generated/prisma/client";

export interface CreateReserveInput {
  organizationId: string;
  amount: bigint;
  currency: string;
  reason: string;
  referenceType: string;
  referenceId: string;
  releaseAt: Date;
}

export interface ReserveRepository {
  create(input: CreateReserveInput): Promise<Reserve>;
  /** A reserva de segurança ainda retida deste pagamento, se houver. */
  findHeldForPayment(paymentId: string): Promise<Reserve | null>;
  findDueForRelease(now: Date, limit: number, organizationId?: string): Promise<{ id: string }[]>;
  lock(id: string): Promise<Reserve>;
  update(id: string, data: { consumedAmount?: bigint; status?: Reserve["status"] }): Promise<Reserve>;
}

export class PrismaReserveRepository implements ReserveRepository {
  constructor(private readonly db: DbClient) {}

  create(input: CreateReserveInput) {
    return this.db.reserve.create({ data: { ...input, status: "HELD" } });
  }

  findHeldForPayment(paymentId: string) {
    return this.db.reserve.findFirst({ where: { referenceType: "Payment", referenceId: paymentId, status: "HELD" } });
  }

  findDueForRelease(now: Date, limit: number, organizationId?: string) {
    return this.db.reserve.findMany({
      where: { status: "HELD", releaseAt: { lte: now }, ...(organizationId ? { organizationId } : {}) },
      select: { id: true },
      orderBy: { releaseAt: "asc" },
      take: limit,
    });
  }

  async lock(id: string) {
    await this.db.$queryRaw`SELECT id FROM "Reserve" WHERE id = ${id} FOR UPDATE`;
    return this.db.reserve.findUniqueOrThrow({ where: { id } });
  }

  update(id: string, data: { consumedAmount?: bigint; status?: Reserve["status"] }) {
    return this.db.reserve.update({ where: { id }, data });
  }
}
