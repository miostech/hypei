import { parseDecimalToMinorUnits } from "@/lib/money";
import type { UnitOfWork } from "@/server/unit-of-work";
import type { TaxRule } from "./tax-policy.repository";
import type { TaxSettingsInput } from "./tax.schemas";

/** O que a tela mostra: a alíquota volta como o produtor digitou, não em basis points. */
export interface TaxSettingsView {
  regime: TaxRule["regime"];
  /** "6,5" — pronto para o campo do formulário. */
  rate: string;
  jurisdiction: string;
}

const EMPTY: TaxSettingsView = { regime: "NONE", rate: "", jurisdiction: "" };

/** "6,5" → 650 bps, pela mesma conversão que os cupons usam. */
const toBps = (rate: string) => Number(parseDecimalToMinorUnits(rate, "BRL"));

/** 600 → "6", 650 → "6,5". Sem zero à direita, que é como a pessoa digitou. */
const fromBps = (bps: number) => String(bps / 100).replace(".", ",");

/**
 * Regime tributário do produtor. A Kabrun não adivinha alíquota: no Brasil ela depende do
 * regime e da faixa de faturamento de cada um, e cobrar a mais é inventar imposto.
 */
export class TaxSettingsService {
  constructor(private readonly uow: UnitOfWork) {}

  async get(organizationId: string): Promise<TaxSettingsView> {
    const own = await this.uow.repos.taxPolicies.findOwn(organizationId);
    if (!own) return EMPTY;
    return {
      regime: own.regime,
      rate: own.rateBps > 0 ? fromBps(own.rateBps) : "",
      jurisdiction: own.jurisdiction ?? "",
    };
  }

  async save(organizationId: string, input: TaxSettingsInput): Promise<void> {
    const rateBps = input.regime === "NONE" || !input.rate ? 0 : toBps(input.rate);
    await this.uow.repos.taxPolicies.saveOwn(organizationId, {
      regime: input.regime,
      rateBps,
      jurisdiction: input.jurisdiction?.trim() || null,
    });
  }
}
