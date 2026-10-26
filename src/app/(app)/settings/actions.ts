"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/modules/organizations/current-organization";
import { taxSettingsSchema } from "@/modules/taxes/tax.schemas";
import { runAction, type ActionState } from "@/server/actions/action-state";
import { getServices } from "@/server/container";

export async function saveTaxSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization } = await requirePermission("organization:manage");
    const input = taxSettingsSchema.parse({
      regime: formData.get("regime"),
      rate: formData.get("rate") || undefined,
      jurisdiction: formData.get("jurisdiction") || undefined,
    });

    await getServices().taxSettings.save(organization.id, input);
    revalidatePath("/settings");
    return {
      status: "success",
      message: input.regime === "NONE" ? "As vendas deixam de destacar imposto." : "Regime salvo. Vale para as próximas vendas.",
    };
  });
}
