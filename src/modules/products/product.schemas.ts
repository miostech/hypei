import { z } from "zod";
import { ProductStatus, ProductType } from "@/generated/prisma/enums";
import { slugSchema } from "@/modules/organizations/organization.schemas";
import type { ProductDeliveryIssue } from "./product-delivery";

export const productInputSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(120),
  slug: slugSchema,
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  type: z.enum(ProductType),
  status: z.enum(ProductStatus),
  thumbnailKey: z.string().trim().max(300).optional().or(z.literal("")),
});

export type ProductInput = z.infer<typeof productInputSchema>;

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  COURSE: "Curso",
  DIGITAL_PRODUCT: "Produto digital",
  COMMUNITY: "Comunidade",
  MENTORSHIP: "Mentoria",
  SUBSCRIPTION: "Assinatura",
  EVENT: "Evento",
  OTHER: "Outro",
};

/** Short form for lists; the full explanation lives in the DeliveryWarning card. */
export const DELIVERY_ISSUE_LABELS: Record<ProductDeliveryIssue, string> = {
  missing: "Sem conteúdo",
  empty: "Conteúdo vazio",
  unpublished: "Conteúdo em rascunho",
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  ARCHIVED: "Arquivado",
};
