import type { PayoutDestination, PaymentProviderType, PixKeyType } from "@/generated/prisma/client";
import type { DbClient } from "@/lib/database/postgres/client";

export interface SavePixDestinationInput {
  organizationId: string;
  provider: PaymentProviderType;
  pixKeyType: PixKeyType;
  pixKey: string;
  currency: string;
  country: string;
}

export interface PayoutDestinationRepository {
  findById(id: string | null): Promise<PayoutDestination | null>;
  findPix(organizationId: string): Promise<PayoutDestination | null>;
  savePix(input: SavePixDestinationInput): Promise<PayoutDestination>;
}

export class PrismaPayoutDestinationRepository implements PayoutDestinationRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string | null) {
    return id ? this.db.payoutDestination.findUnique({ where: { id } }) : null;
  }

  findPix(organizationId: string) {
    return this.db.payoutDestination.findUnique({ where: { organizationId_type: { organizationId, type: "PIX" } } });
  }

  /** Uma chave por organização: trocar a chave é atualizar esta linha, não guardar outra. */
  savePix({ organizationId, ...rest }: SavePixDestinationInput) {
    const data = { ...rest, type: "PIX" as const, status: "ACTIVE" as const };
    return this.db.payoutDestination.upsert({
      where: { organizationId_type: { organizationId, type: "PIX" } },
      create: { organizationId, ...data },
      update: data,
    });
  }
}
