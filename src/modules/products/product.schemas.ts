import { z } from "zod";
import { ProductStatus, ProductType } from "@/generated/prisma/enums";
import { slugSchema } from "@/modules/organizations/organization.schemas";

export const productInputSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(120),
  slug: slugSchema,
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  type: z.enum(ProductType),
  status: z.enum(ProductStatus),
  thumbnailUrl: z.string().trim().url("URL inválida").optional().or(z.literal("")),
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

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  ARCHIVED: "Arquivado",
};
