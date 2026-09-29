"use server";

import { revalidatePath } from "next/cache";
import { couponInputSchema } from "@/modules/coupons/coupon.schemas";
import { requirePermission } from "@/modules/organizations/current-organization";
import { runAction, type ActionState } from "@/server/actions/action-state";
import { getServices } from "@/server/container";

const EDIT = "products:write" as const;

function parseInput(formData: FormData) {
  return couponInputSchema.parse({
    code: formData.get("code"),
    type: formData.get("type"),
    percentage: formData.get("percentage") || undefined,
    amount: formData.get("amount") || undefined,
    currency: formData.get("currency"),
    minAmount: formData.get("minAmount") || undefined,
    productId: formData.get("productId") || undefined,
    maxRedemptions: formData.get("maxRedemptions") || undefined,
    oncePerCustomer: formData.get("oncePerCustomer") === "on",
    expiresAt: formData.get("expiresAt") || undefined,
    active: formData.get("active") !== "false",
  });
}

export async function createCoupon(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization, userId } = await requirePermission(EDIT);
    await getServices().coupons.create(organization.id, userId, parseInput(formData));
    revalidatePath("/coupons");
    return { status: "success", message: "Cupom criado" };
  });
}

export async function updateCoupon(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization, userId } = await requirePermission(EDIT);
    await getServices().coupons.update(organization.id, userId, String(formData.get("couponId")), parseInput(formData));
    revalidatePath("/coupons");
    return { status: "success", message: "Cupom atualizado" };
  });
}

export async function setCouponActive(formData: FormData): Promise<void> {
  const { organization, userId } = await requirePermission(EDIT);
  await getServices().coupons.setActive(organization.id, userId, String(formData.get("couponId")), formData.get("active") === "true");
  revalidatePath("/coupons");
}

export async function deleteCoupon(formData: FormData): Promise<void> {
  const { organization, userId } = await requirePermission(EDIT);
  await getServices().coupons.remove(organization.id, userId, String(formData.get("couponId")));
  revalidatePath("/coupons");
}
