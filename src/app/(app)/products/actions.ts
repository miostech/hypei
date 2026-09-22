"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { productInputSchema } from "@/modules/products/product.schemas";
import { requirePermission } from "@/modules/organizations/current-organization";
import { runAction, type ActionState } from "@/server/actions/action-state";
import { getServices } from "@/server/container";

function parse(formData: FormData) {
  return productInputSchema.parse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    type: formData.get("type"),
    status: formData.get("status"),
    thumbnailUrl: formData.get("thumbnailUrl") ?? "",
  });
}

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let productId: string | undefined;
  const result = await runAction(async () => {
    const { organization, userId } = await requirePermission("products:write");
    const product = await getServices().products.create(organization.id, userId, parse(formData));
    productId = product.id;
    revalidatePath("/products");
    return { status: "success", message: "Produto criado" };
  });
  if (productId) redirect(`/products/${productId}?created=1`);
  return result;
}

export async function updateProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization, userId } = await requirePermission("products:write");
    const id = String(formData.get("id"));
    await getServices().products.update(organization.id, userId, id, parse(formData));
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return { status: "success", message: "Produto atualizado" };
  });
}

export async function archiveProduct(formData: FormData): Promise<void> {
  const { organization, userId } = await requirePermission("products:write");
  await getServices().products.archive(organization.id, userId, String(formData.get("id")));
  revalidatePath("/products");
  redirect("/products");
}
