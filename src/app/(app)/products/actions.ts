"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ImageUploadRequest, ImageUploadResult } from "@/components/shared/image-upload-field";
import { isDomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
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
    thumbnailKey: formData.get("thumbnailKey") ?? "",
  });
}

/**
 * Entrega ao navegador uma URL de envio de vida curta. O arquivo não passa pelo servidor:
 * isto só diz "você pode colocar este objeto ali, pelos próximos minutos".
 */
export async function requestThumbnailUpload(input: ImageUploadRequest): Promise<ImageUploadResult> {
  try {
    const { organization } = await requirePermission("products:write");
    const target = await getServices().products.createThumbnailUpload(organization.id, input.ownerId, {
      filename: input.filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    });
    return { ok: true, url: target.url, key: target.key, headers: target.headers };
  } catch (error) {
    if (isDomainError(error)) return { ok: false, message: error.message };
    logger.error({ err: error }, "product thumbnail upload authorization failed");
    return { ok: false, message: "Não foi possível preparar o envio da imagem." };
  }
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
