"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/modules/auth/current-user";
import { runAction, type ActionState } from "@/server/actions/action-state";
import { getServices } from "@/server/container";

/** Records that the plaque was sent, with the tracking code the producer will see. */
export async function registerAwardShipping(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePlatformAdmin();
    await getServices().awards.registerShipping(String(formData.get("awardId")), String(formData.get("trackingCode") ?? ""));
    revalidatePath("/admin/awards");
    return { status: "success", message: "Envio registrado" };
  });
}
