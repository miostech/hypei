"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { offerInputSchema } from "@/modules/offers/offer.schemas";
import { requirePermission } from "@/modules/organizations/current-organization";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { runAction, type ActionState } from "@/server/actions/action-state";
import { getServices } from "@/server/container";

function parse(formData: FormData) {
  const billingType = formData.get("billingType");
  return offerInputSchema.parse({
    productId: formData.get("productId"),
    name: formData.get("name"),
    price: formData.get("price"),
    currency: formData.get("currency"),
    billingType,
    installments: billingType === "INSTALLMENTS" ? formData.get("installments") : undefined,
    billingInterval: billingType === "SUBSCRIPTION" ? (formData.get("billingInterval") ?? undefined) : undefined,
    trialDays: billingType === "SUBSCRIPTION" ? (formData.get("trialDays") ?? undefined) : undefined,
    active: formData.get("active") === "on",
  });
}

export async function createOffer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let offerId: string | undefined;
  const result = await runAction(async () => {
    const { organization, userId } = await requirePermission("products:write");
    const offer = await getServices().offers.create(organization.id, userId, parse(formData));
    offerId = offer.id;
    revalidatePath("/offers");
    // Os preços do produto aparecem na aba Geral dele.
    revalidatePath("/products/[productId]", "page");
    return { status: "success", message: (await getAppDictionary(await appLocale())).toasts.offerCreated };
  });
  if (offerId) redirect(`/offers/${offerId}?created=1`);
  return result;
}

export async function updateOffer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization, userId } = await requirePermission("products:write");
    const id = String(formData.get("id"));
    await getServices().offers.update(organization.id, userId, id, parse(formData));
    revalidatePath("/offers");
    revalidatePath(`/offers/${id}`);
    revalidatePath("/products/[productId]", "page");
    return { status: "success", message: (await getAppDictionary(await appLocale())).toasts.offerUpdated };
  });
}
