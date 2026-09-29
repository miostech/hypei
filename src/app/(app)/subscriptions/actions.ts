"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/modules/organizations/current-organization";
import { runAction, type ActionState } from "@/server/actions/action-state";
import { getServices } from "@/server/container";

/**
 * Cancels a subscription. "at_period_end" keeps the access the customer already
 * paid for; "now" cuts it immediately.
 */
export async function cancelSubscription(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization, userId } = await requirePermission("sales:read");
    const mode = formData.get("mode") === "now" ? "now" : "at_period_end";
    await getServices().subscriptions.cancel(organization.id, userId, String(formData.get("subscriptionId")), mode);
    revalidatePath("/subscriptions");
    return {
      status: "success",
      message: mode === "now" ? "Assinatura cancelada" : "Cancelamento agendado para o fim do período",
    };
  });
}
