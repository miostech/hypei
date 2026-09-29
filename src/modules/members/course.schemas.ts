import { z } from "zod";
import { LessonType } from "@/generated/prisma/enums";
import { slugSchema } from "@/modules/organizations/organization.schemas";

export const courseInputSchema = z.object({
  productId: z.string().min(1, "Selecione um produto"),
  title: z.string().trim().min(2, "Informe o título").max(120),
  slug: slugSchema,
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CourseInput = z.infer<typeof courseInputSchema>;

export const courseSettingsSchema = courseInputSchema.omit({ productId: true });
export type CourseSettingsInput = z.infer<typeof courseSettingsSchema>;

export const moduleInputSchema = z.object({
  title: z.string().trim().min(2, "Informe o título do módulo").max(120),
});

/**
 * A media lesson carries either an uploaded file (storageKey) or an external link
 * — hosting on YouTube or Vimeo stays a first-class option, not a fallback.
 */
export const lessonInputSchema = z
  .object({
    title: z.string().trim().min(2, "Informe o título da aula").max(160),
    type: z.enum(LessonType),
    durationMinutes: z.coerce.number().int().min(0).max(1440).optional(),
    externalUrl: z.string().trim().url("URL inválida").optional().or(z.literal("")),
    content: z.string().trim().max(20_000).optional().or(z.literal("")),
    /** Object key returned by the upload the browser just completed. */
    storageKey: z.string().trim().max(400).optional().or(z.literal("")),
    storageFilename: z.string().trim().max(180).optional().or(z.literal("")),
    storageType: z.string().trim().max(120).optional().or(z.literal("")),
    storageBytes: z.coerce.number().int().min(0).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "TEXT" && !value.content) {
      ctx.addIssue({ code: "custom", path: ["content"], message: "Escreva o conteúdo da aula" });
    }
    if (value.type !== "TEXT" && !value.externalUrl && !value.storageKey) {
      ctx.addIssue({ code: "custom", path: ["externalUrl"], message: "Envie um arquivo ou informe o link" });
    }
  });

export type LessonInput = z.infer<typeof lessonInputSchema>;

export const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  VIDEO: "Vídeo",
  TEXT: "Texto",
  PDF: "PDF",
  AUDIO: "Áudio",
  LIVE: "Ao vivo",
  DOWNLOAD: "Download",
};
