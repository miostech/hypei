import { z } from "zod";
import { ProductStatus, ProductType } from "@/generated/prisma/enums";
import { slugSchema } from "@/modules/organizations/organization.schemas";

export const productInputSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(120),
  slug: slugSchema,
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  type: z.enum(ProductType),
  status: z.enum(ProductStatus),
  thumbnailKey: z.string().trim().max(300).optional().or(z.literal("")),
});

export type ProductInput = z.infer<typeof productInputSchema>;

