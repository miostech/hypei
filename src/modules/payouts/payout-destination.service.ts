import type { PayoutDestination, PaymentProviderType } from "@/generated/prisma/client";
import { ValidationError } from "@/lib/errors";
import { COUNTRY_INFO, type CountryCode } from "@/modules/organizations/countries";
import { hashTaxId } from "@/modules/compliance/tax-identity";
import type { UnitOfWork } from "@/server/unit-of-work";
import { maskPixKey, parsePixKey, type PixKey } from "./pix-key";

export interface PixDestinationView {
  pixKey: string;
  pixKeyType: PixKey["type"];
  masked: string;
  updatedAt: Date;
}

/** `true` quando o país paga por Pix — hoje, só o Brasil. */
export function paysWithPix(country: string): boolean {
  return COUNTRY_INFO[country as CountryCode]?.region === "BR";
}

/**
 * Onde o dinheiro do saque cai.
 *
 * Fora do Brasil quem paga é a Stripe, para a conta bancária que a produtora cadastrou no
 * onboarding dela — não há o que guardar aqui. No Brasil quem paga é a Kabrun, por Pix, e sem
 * a chave não há para onde mandar: por isso ela é condição do saque, e não um campo opcional.
 */
export class PayoutDestinationService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly provider: PaymentProviderType,
    private readonly dataHashSecret: string,
  ) {}

  async getPix(organizationId: string): Promise<PixDestinationView | null> {
    const found = await this.uow.repos.payoutDestinations.findPix(organizationId);
    return found ? toView(found) : null;
  }

  /**
   * Guarda a chave que a produtora digitou. Recusa o que o DICT recusaria depois — formato
   * inválido — e o que a Kabrun não pode pagar: chave de documento que não é o documento da
   * conta. Esse é o erro caro, porque o Pix cai na conta de outro titular e não volta sozinho.
   */
  async savePix(input: { organizationId: string; country: string; currency: string; rawKey: string; userId?: string | null }) {
    if (!paysWithPix(input.country)) throw new ValidationError("Pix is only available for Brazilian accounts");

    const key = parsePixKey(input.rawKey);
    if (!key) throw new ValidationError("Chave Pix inválida. Use CPF, CNPJ, e-mail, telefone ou a chave aleatória.", { field: "pixKey" });
    if (key.type === "CPF" || key.type === "CNPJ") await this.assertOwnDocument(input.organizationId, key.type, key.value);

    const saved = await this.uow.transaction(async (repos) => {
      const destination = await repos.payoutDestinations.savePix({
        organizationId: input.organizationId,
        provider: this.provider,
        pixKeyType: key.type,
        pixKey: key.value,
        currency: input.currency,
        country: input.country,
      });
      await repos.audit.record({
        organizationId: input.organizationId,
        userId: input.userId,
        action: "payout.destination.saved",
        entity: "PayoutDestination",
        entityId: destination.id,
        // A chave inteira não entra na auditoria: para reconhecer qual é, o mascarado basta.
        metadata: { type: key.type, pixKey: maskPixKey(key) },
      });
      return destination;
    });

    return toView(saved);
  }

  /**
   * A chave de CPF/CNPJ precisa ser o documento da própria conta. Conferimos pelo hash que já
   * guardamos na identidade fiscal, então o documento continua sem nunca ser lido de volta.
   */
  private async assertOwnDocument(organizationId: string, type: "CPF" | "CNPJ", value: string) {
    const hashes = await this.uow.repos.organizations.taxIdentityHashes(organizationId);
    const expected = hashTaxId(type, value, this.dataHashSecret);
    if (!hashes.some((identity) => identity.type === type && identity.valueHash === expected)) {
      throw new ValidationError(`A chave Pix precisa ser o ${type} da conta. Pix cai na conta do titular da chave, e não volta sozinho.`, {
        field: "pixKey",
      });
    }
  }
}

function toView(destination: PayoutDestination): PixDestinationView {
  const key = { type: destination.pixKeyType!, value: destination.pixKey! };
  return { pixKey: key.value, pixKeyType: key.type, masked: maskPixKey(key), updatedAt: destination.updatedAt };
}
