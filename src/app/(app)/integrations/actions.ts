"use server";

import { revalidatePath } from "next/cache";
import { getEnv } from "@/lib/env";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { requirePermission } from "@/modules/organizations/current-organization";
import { runAction, type ActionState } from "@/server/actions/action-state";
import { getServices } from "@/server/container";

/**
 * Creates the merchant account when missing and returns the provider-hosted onboarding link.
 * Sensitive identity/bank data is collected by the provider, never by Kabrun.
 */
export async function startMerchantOnboarding(): Promise<ActionState & { url?: string }> {
  const result = await runAction(async () => {
    const { organization } = await requirePermission("integrations:manage");
    const services = getServices();
    await services.merchantAccounts.ensureForOrganization(organization, organization.supportEmail ?? undefined);
    const link = await services.merchantAccounts.createOnboardingLink(organization.id, getEnv().APP_URL);
    revalidatePath("/integrations");
    return { status: "success", message: link.url };
  });
  return result.status === "success" ? { ...result, url: result.message } : result;
}

export async function syncMerchantAccount(): Promise<ActionState> {
  return runAction(async () => {
    const { organization } = await requirePermission("integrations:manage");
    await getServices().merchantAccounts.sync(organization.id);
    revalidatePath("/integrations");
    revalidatePath("/finance");
    return { status: "success", message: (await getAppDictionary(await appLocale())).toasts.statusUpdated };
  });
}
