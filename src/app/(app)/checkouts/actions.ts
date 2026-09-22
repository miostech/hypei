"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PaymentMethodType } from "@/generated/prisma/enums";
import { checkoutBuilderSchema } from "@/modules/checkout/checkout.schemas";
import { requirePermission } from "@/modules/organizations/current-organization";
import { runAction, type ActionState } from "@/server/actions/action-state";
import { getServices } from "@/server/container";

function parse(formData: FormData) {
  return checkoutBuilderSchema.parse({
    offerId: formData.get("offerId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    headline: formData.get("headline"),
    description: formData.get("description") ?? "",
    accentColor: formData.get("accentColor"),
    logoUrl: formData.get("logoUrl") ?? "",
    collectPhone: formData.get("collectPhone") === "on",
    guaranteeDays: formData.get("guaranteeDays"),
    enabledPaymentMethods: formData.getAll("enabledPaymentMethods").filter((m): m is PaymentMethodType => typeof m === "string" && m in PaymentMethodType),
  });
}

export async function createCheckout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let checkoutId: string | undefined;
  const result = await runAction(async () => {
    const { organization, userId } = await requirePermission("checkout:write");
    const checkout = await getServices().checkouts.create(organization.id, userId, parse(formData));
    checkoutId = checkout.id;
    revalidatePath("/checkouts");
    return { status: "success", message: "Checkout criado" };
  });
  if (checkoutId) redirect(`/checkouts/${checkoutId}?created=1`);
  return result;
}

/** Saving always produces a NEW version so past orders keep their original checkout. */
export async function updateCheckout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization, userId } = await requirePermission("checkout:write");
    const id = String(formData.get("id"));
    const { version } = await getServices().checkouts.updateConfig(organization.id, userId, id, parse(formData));
    revalidatePath(`/checkouts/${id}`);
    return { status: "success", message: `Checkout salvo (versão ${version})` };
  });
}
