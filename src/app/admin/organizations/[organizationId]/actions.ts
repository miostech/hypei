"use server";

import { revalidatePath } from "next/cache";
import { ValidationError } from "@/lib/errors";
import { assertSupportedCurrency, parseDecimalToMinorUnits } from "@/lib/money";
import { requirePlatformAdmin } from "@/modules/auth/current-user";
import { runAction, type ActionState } from "@/server/actions/action-state";
import { getServices } from "@/server/container";

/**
 * "8,99" vira 899 bps. Dois decimais porque é o que a tela aceita e o que o mercado usa; mais
 * do que isso não cabe em basis points e arredondar escondido mudaria a taxa que o admin leu.
 */
function parsePercentageBps(raw: string): number {
  const normalized = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new ValidationError("Use um número como 8,99", { field: "percentage" });
  }
  return Math.round(Number(normalized) * 100);
}

/** Grava a taxa negociada desta organização nesta moeda. */
export async function saveNegotiatedFee(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const organizationId = String(formData.get("organizationId"));
    const currency = assertSupportedCurrency(String(formData.get("currency")));

    await getServices().platformFees.setForOrganization({
      organizationId,
      currency,
      percentageBps: parsePercentageBps(String(formData.get("percentage") ?? "")),
      fixedAmount: parseDecimalToMinorUnits(String(formData.get("fixedAmount") ?? "0"), currency),
      userId: admin.id,
    });

    revalidatePath(`/admin/organizations/${organizationId}`);
    return { status: "success", message: `Taxa em ${currency} atualizada` };
  });
}

/** Devolve a organização para a taxa que vale para todas. */
export async function resetNegotiatedFee(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const organizationId = String(formData.get("organizationId"));
    const currency = assertSupportedCurrency(String(formData.get("currency")));

    await getServices().platformFees.clearForOrganization({ organizationId, currency, userId: admin.id });

    revalidatePath(`/admin/organizations/${organizationId}`);
    return { status: "success", message: `Taxa em ${currency} voltou para a padrão` };
  });
}
