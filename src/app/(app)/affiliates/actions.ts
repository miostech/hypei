"use server";

import { revalidatePath } from "next/cache";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { plural } from "@/lib/i18n/locale";
import { affiliateInputSchema } from "@/modules/affiliates/affiliate.schemas";
import { requirePermission } from "@/modules/organizations/current-organization";
import { runAction, type ActionState } from "@/server/actions/action-state";
import { getServices } from "@/server/container";

const EDIT = "products:write" as const;

function parseInput(formData: FormData) {
  return affiliateInputSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    commissionBps: formData.get("commissionBps"),
    checkoutId: formData.get("checkoutId") || undefined,
    active: formData.get("active") !== "false",
  });
}

export async function createAffiliate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization, userId } = await requirePermission(EDIT);
    await getServices().affiliates.create(organization.id, userId, parseInput(formData));
    revalidatePath("/affiliates");
    const dict = await getAppDictionary(await appLocale());
    return { status: "success", message: dict.toasts.affiliateCreated };
  });
}

export async function updateAffiliate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization, userId } = await requirePermission(EDIT);
    await getServices().affiliates.update(organization.id, userId, String(formData.get("affiliateId")), parseInput(formData));
    revalidatePath("/affiliates");
    const dict = await getAppDictionary(await appLocale());
    return { status: "success", message: dict.toasts.affiliateUpdated };
  });
}

export async function setAffiliateActive(formData: FormData): Promise<void> {
  const { organization, userId } = await requirePermission(EDIT);
  await getServices().affiliates.setActive(
    organization.id,
    userId,
    String(formData.get("affiliateId")),
    formData.get("active") === "true",
  );
  revalidatePath("/affiliates");
}

/** Records that the commissions currently payable were sent to the affiliate. */
export async function payAffiliate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization, userId } = await requirePermission("finance:read");
    const result = await getServices().affiliates.payCommissions(organization.id, userId, String(formData.get("affiliateId")));
    revalidatePath("/affiliates");
    const dict = await getAppDictionary(await appLocale());
    return { status: "success", message: plural(dict.locale, result.count, dict.toasts.commissionsPaid) };
  });
}
