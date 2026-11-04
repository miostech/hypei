"use server";

import { revalidatePath } from "next/cache";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { requirePermission } from "@/modules/organizations/current-organization";
import { runAction, type ActionState } from "@/server/actions/action-state";
import { getServices } from "@/server/container";

export async function savePixKey(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization, userId } = await requirePermission("organization:manage");

    await getServices().payoutDestinations.savePix({
      organizationId: organization.id,
      country: organization.country,
      currency: organization.defaultCurrency,
      rawKey: String(formData.get("pixKey") ?? ""),
      userId,
    });

    revalidatePath("/settings");
    return { status: "success", message: (await getAppDictionary(await appLocale())).settings.pixSaved };
  });
}
