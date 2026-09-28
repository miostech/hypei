"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { memberLessonHref } from "@/lib/ui/routes";
import { requireUser } from "@/modules/auth/current-user";
import { getServices } from "@/server/container";

/**
 * Marks a lesson watched (or unwatched) for the signed-in student and moves on to the
 * next lesson when there is one. Only enrolled students reach the service call.
 */
export async function setLessonCompleted(formData: FormData): Promise<void> {
  const user = await requireUser();
  const services = getServices();

  const organizationSlug = String(formData.get("organizationSlug"));
  const courseSlug = String(formData.get("courseSlug"));
  const lessonId = String(formData.get("lessonId"));
  const completed = formData.get("completed") === "true";
  const nextLessonId = formData.get("nextLessonId");

  const organization = await services.uow.repos.organizations.findBySlug(organizationSlug);
  if (!organization) return;

  const course = await services.memberArea.getCourse(organization.id, courseSlug);
  const access = await services.memberArea.resolveAccess(course.id, user, organization.id);
  if (!access) return;

  await services.memberArea.setLessonCompleted(organization.id, courseSlug, lessonId, access, completed);

  const base = `/members/${organizationSlug}/courses/${courseSlug}`;
  revalidatePath(base);
  revalidatePath(`${base}/${lessonId}`);

  if (completed && typeof nextLessonId === "string" && nextLessonId) {
    redirect(memberLessonHref(organizationSlug, courseSlug, nextLessonId));
  }
}
