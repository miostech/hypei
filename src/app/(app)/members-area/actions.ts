"use server";

import { revalidatePath } from "next/cache";
import type { LessonType } from "@/generated/prisma/enums";
import { isDomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { redirect } from "next/navigation";
import { courseInputSchema, courseSettingsSchema, lessonInputSchema, moduleInputSchema } from "@/modules/members/course.schemas";
import { requirePermission } from "@/modules/organizations/current-organization";
import { runAction, type ActionState } from "@/server/actions/action-state";
import { getServices } from "@/server/container";

const EDIT = "products:write" as const;

function revalidateCourse(courseId?: string) {
  revalidatePath("/members-area");
  if (courseId) revalidatePath(`/members-area/${courseId}`);
}

// ── Course ─────────────────────────────────────────────────────────────────
export async function createCourse(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let courseId: string | undefined;
  const result = await runAction(async () => {
    const { organization, userId } = await requirePermission(EDIT);
    const input = courseInputSchema.parse({
      productId: formData.get("productId"),
      title: formData.get("title"),
      slug: formData.get("slug"),
      description: formData.get("description") ?? "",
    });
    const course = await getServices().courses.create(organization.id, userId, input);
    courseId = course.id;
    revalidateCourse();
    return { status: "success", message: "Curso criado" };
  });
  if (courseId) redirect(`/members-area/${courseId}`);
  return result;
}

export async function updateCourseSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization, userId } = await requirePermission(EDIT);
    const courseId = String(formData.get("courseId"));
    const input = courseSettingsSchema.parse({
      title: formData.get("title"),
      slug: formData.get("slug"),
      description: formData.get("description") ?? "",
    });
    await getServices().courses.updateSettings(organization.id, userId, courseId, input);
    revalidateCourse(courseId);
    return { status: "success", message: "Curso atualizado" };
  });
}

export async function setCoursePublished(formData: FormData): Promise<void> {
  const { organization, userId } = await requirePermission(EDIT);
  const courseId = String(formData.get("courseId"));
  await getServices().courses.setPublished(organization.id, userId, courseId, formData.get("published") === "true");
  revalidateCourse(courseId);
}

// ── Modules ────────────────────────────────────────────────────────────────
export async function addModule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization } = await requirePermission(EDIT);
    const courseId = String(formData.get("courseId"));
    const { title } = moduleInputSchema.parse({ title: formData.get("title") });
    await getServices().courses.addModule(organization.id, courseId, title);
    revalidateCourse(courseId);
    return { status: "success", message: "Módulo criado" };
  });
}

export async function renameModule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization } = await requirePermission(EDIT);
    const { title } = moduleInputSchema.parse({ title: formData.get("title") });
    await getServices().courses.renameModule(organization.id, String(formData.get("moduleId")), title);
    revalidateCourse(String(formData.get("courseId")));
    return { status: "success", message: "Módulo atualizado" };
  });
}

export async function deleteModule(formData: FormData): Promise<void> {
  const { organization } = await requirePermission(EDIT);
  await getServices().courses.removeModule(organization.id, String(formData.get("moduleId")));
  revalidateCourse(String(formData.get("courseId")));
}

export async function moveModule(formData: FormData): Promise<void> {
  const { organization } = await requirePermission(EDIT);
  const direction = formData.get("direction") === "up" ? "up" : "down";
  await getServices().courses.moveModule(organization.id, String(formData.get("moduleId")), direction);
  revalidateCourse(String(formData.get("courseId")));
}

/**
 * Hands the browser a short-lived upload URL. The file never goes through the
 * server: this only says "you may put this object there, for the next minutes".
 */
export async function requestLessonUpload(input: {
  moduleId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  type: LessonType;
}): Promise<{ ok: true; url: string; key: string; headers: Record<string, string> } | { ok: false; message: string }> {
  try {
    const { organization } = await requirePermission(EDIT);
    const target = await getServices().courses.createLessonUpload(organization.id, input.moduleId, {
      filename: input.filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      type: input.type,
    });
    return { ok: true, url: target.url, key: target.key, headers: target.headers };
  } catch (error) {
    if (isDomainError(error)) return { ok: false, message: error.message };
    logger.error({ err: error }, "lesson upload authorization failed");
    return { ok: false, message: "Não foi possível preparar o envio do arquivo." };
  }
}

// ── Lessons ────────────────────────────────────────────────────────────────
function parseLesson(formData: FormData) {
  return lessonInputSchema.parse({
    title: formData.get("title"),
    type: formData.get("type"),
    durationMinutes: formData.get("durationMinutes") || undefined,
    externalUrl: formData.get("externalUrl") ?? "",
    content: formData.get("content") ?? "",
    storageKey: formData.get("storageKey") ?? "",
    storageFilename: formData.get("storageFilename") ?? "",
    storageType: formData.get("storageType") ?? "",
    storageBytes: formData.get("storageBytes") || undefined,
  });
}

export async function addLesson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization } = await requirePermission(EDIT);
    await getServices().courses.addLesson(organization.id, String(formData.get("moduleId")), parseLesson(formData));
    revalidateCourse(String(formData.get("courseId")));
    return { status: "success", message: "Aula adicionada" };
  });
}

export async function updateLesson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization } = await requirePermission(EDIT);
    await getServices().courses.updateLesson(organization.id, String(formData.get("lessonId")), parseLesson(formData));
    revalidateCourse(String(formData.get("courseId")));
    return { status: "success", message: "Aula atualizada" };
  });
}

export async function deleteLesson(formData: FormData): Promise<void> {
  const { organization } = await requirePermission(EDIT);
  await getServices().courses.removeLesson(organization.id, String(formData.get("lessonId")));
  revalidateCourse(String(formData.get("courseId")));
}

export async function moveLesson(formData: FormData): Promise<void> {
  const { organization } = await requirePermission(EDIT);
  const direction = formData.get("direction") === "up" ? "up" : "down";
  await getServices().courses.moveLesson(organization.id, String(formData.get("lessonId")), direction);
  revalidateCourse(String(formData.get("courseId")));
}
