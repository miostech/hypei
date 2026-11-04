"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ImageUploadRequest, ImageUploadResult } from "@/components/shared/image-upload-field";
import { isDomainError } from "@/lib/errors";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { logger } from "@/lib/logger";
import { affiliationOfferSchema } from "@/modules/affiliates/affiliate.schemas";
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
    return { ok: false, message: (await getAppDictionary(await appLocale())).toasts.imageUploadFailed };
  }
}

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let productId: string | undefined;
  const result = await runAction(async () => {
    const { organization, userId } = await requirePermission("products:write");
    const product = await getServices().products.create(organization.id, userId, parse(formData));
    productId = product.id;
    revalidatePath("/products");
    return { status: "success", message: (await getAppDictionary(await appLocale())).toasts.productCreated };
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
    return { status: "success", message: (await getAppDictionary(await appLocale())).toasts.productUpdated };
  });
}

export async function archiveProduct(formData: FormData): Promise<void> {
  const { organization, userId } = await requirePermission("products:write");
  await getServices().products.archive(organization.id, userId, String(formData.get("id")));
  revalidatePath("/products");
  redirect("/products");
}

/**
 * Abre o produto para afiliados: gera o link de convite e publica a comissão oferecida.
 *
 * A comissão é a mesma para todo mundo que aceitar o convite. Negociar caso a caso continua
 * possível pelo cadastro manual de afiliado, que define a comissão por pessoa.
 */
export async function openAffiliateProgram(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization, userId } = await requirePermission("products:write");
    const productId = String(formData.get("productId"));
    const { commission } = affiliationOfferSchema.parse({ commission: formData.get("commission") });
    await getServices().affiliates.enableAffiliation(organization.id, userId, productId, commission);
    revalidatePath(`/products/${productId}`);
    return { status: "success", message: (await getAppDictionary(await appLocale())).toasts.affiliationOpened };
  });
}

/** Fecha o convite. Quem já se afiliou continua vendendo e ganhando. */
export async function closeAffiliateProgram(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization, userId } = await requirePermission("products:write");
    const productId = String(formData.get("productId"));
    await getServices().affiliates.disableAffiliation(organization.id, userId, productId);
    revalidatePath(`/products/${productId}`);
    return { status: "success", message: (await getAppDictionary(await appLocale())).toasts.affiliationClosed };
  });
}
