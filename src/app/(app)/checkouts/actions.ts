"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ImageUploadRequest, ImageUploadResult } from "@/components/shared/image-upload-field";
import { PaymentMethodType } from "@/generated/prisma/enums";
import { isDomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { checkoutBuilderSchema, type OrderBumpInput } from "@/modules/checkout/checkout.schemas";
import { requirePermission } from "@/modules/organizations/current-organization";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { runAction, type ActionState } from "@/server/actions/action-state";
import { getServices } from "@/server/container";

/**
 * Os order bumps chegam como nomes repetidos, uma entrada por linha do formulário, e aqui são
 * casados pela posição. Remover uma linha a tira do formulário inteiro, então o que chega são
 * as linhas que sobraram — sem buraco no meio para desalinhar os campos.
 *
 * Linha sem oferta escolhida é descartada em silêncio: é linha recém-adicionada e abandonada,
 * não erro que valha travar o salvamento do resto da página.
 */
function parseBumps(formData: FormData): OrderBumpInput[] {
  const offerIds = formData.getAll("bumpOfferId");
  const headlines = formData.getAll("bumpHeadline");
  const descriptions = formData.getAll("bumpDescription");
  const prices = formData.getAll("bumpPrice");
  const compareAtPrices = formData.getAll("bumpCompareAtPrice");

  return offerIds.flatMap((offerId, index) => {
    if (typeof offerId !== "string" || !offerId) return [];
    return [
      {
        offerId,
        headline: String(headlines[index] ?? ""),
        description: String(descriptions[index] ?? ""),
        price: String(prices[index] ?? ""),
        compareAtPrice: String(compareAtPrices[index] ?? ""),
      },
    ];
  });
}

function parse(formData: FormData) {
  return checkoutBuilderSchema.parse({
    offerId: formData.get("offerId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    headline: formData.get("headline"),
    description: formData.get("description") ?? "",
    accentColor: formData.get("accentColor"),
    logoKey: formData.get("logoKey") ?? "",
    bannerKey: formData.get("bannerKey") ?? "",
    collectPhone: formData.get("collectPhone") === "on",
    guaranteeDays: formData.get("guaranteeDays"),
    enabledPaymentMethods: formData.getAll("enabledPaymentMethods").filter((m): m is PaymentMethodType => typeof m === "string" && m in PaymentMethodType),
    orderBumps: parseBumps(formData),
  });
}

/**
 * Entrega ao navegador uma URL de envio de vida curta. O arquivo não passa pelo servidor:
 * isto só diz "você pode colocar este objeto ali, pelos próximos minutos".
 */
export async function requestCheckoutImageUpload(input: ImageUploadRequest): Promise<ImageUploadResult> {
  try {
    const { organization } = await requirePermission("checkout:write");
    const target = await getServices().checkouts.createImageUpload(organization.id, input.ownerId, {
      filename: input.filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    });
    return { ok: true, url: target.url, key: target.key, headers: target.headers };
  } catch (error) {
    if (isDomainError(error)) return { ok: false, message: error.message };
    logger.error({ err: error }, "checkout image upload authorization failed");
    return { ok: false, message: (await getAppDictionary(await appLocale())).toasts.imageUploadFailed };
  }
}

export async function createCheckout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let checkoutId: string | undefined;
  const result = await runAction(async () => {
    const { organization, userId } = await requirePermission("checkout:write");
    const checkout = await getServices().checkouts.create(organization.id, userId, parse(formData));
    checkoutId = checkout.id;
    revalidatePath("/checkouts");
    // O checkout também é editado de dentro do produto, nas abas Checkout e Links.
    revalidatePath("/products/[productId]", "page");
    return { status: "success", message: (await getAppDictionary(await appLocale())).toasts.checkoutCreated };
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
    revalidatePath("/products/[productId]", "page");
    return { status: "success", message: `Checkout salvo (versão ${version})` };
  });
}
