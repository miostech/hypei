import type { Lesson } from "@/generated/prisma/client";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { UnitOfWork } from "@/server/unit-of-work";

export interface LessonOutlineItem {
  id: string;
  title: string;
  type: Lesson["type"];
  durationSeconds: number | null;
  completed: boolean;
}

export interface CourseOutline {
  modules: { id: string; title: string; lessons: LessonOutlineItem[] }[];
  totalLessons: number;
  completedLessons: number;
  percentage: number;
  /** Where the "continue" button goes: last opened lesson, else the first unfinished one. */
  resumeLessonId: string | null;
}

/** How the student reached the course: as a buyer, or as a team member previewing it. */
export type MemberAccess = { kind: "enrolled"; enrollmentId: string } | { kind: "preview" };

/**
 * Student-facing side of the member area. Progress only exists for real enrollments —
 * a producer previewing their own course never writes progress rows.
 */
export class MemberAreaService {
  constructor(private readonly uow: UnitOfWork) {}

  async resolveAccess(courseId: string, user: { id: string; email: string }, organizationId: string): Promise<MemberAccess | null> {
    const enrollment = await this.uow.repos.progress.findEnrollment(courseId, user.email);
    if (enrollment) return { kind: "enrolled", enrollmentId: enrollment.id };
    const membership = await this.uow.repos.organizations.findMembership(organizationId, user.id);
    return membership ? { kind: "preview" } : null;
  }

  async getCourse(organizationId: string, courseSlug: string) {
    const course = await this.uow.repos.courses.findBySlug(organizationId, courseSlug);
    if (!course || !course.published) throw new NotFoundError("Course", courseSlug);
    return course;
  }

  async outline(organizationId: string, courseSlug: string, access: MemberAccess): Promise<CourseOutline> {
    const course = await this.getCourse(organizationId, courseSlug);
    const progress =
      access.kind === "enrolled" ? await this.uow.repos.progress.listProgress(access.enrollmentId) : [];
    const completed = new Set(progress.filter((row) => row.completedAt).map((row) => row.lessonId));

    const modules = course.modules.map((module) => ({
      id: module.id,
      title: module.title,
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        durationSeconds: lesson.durationSeconds,
        completed: completed.has(lesson.id),
      })),
    }));

    const allLessons = modules.flatMap((module) => module.lessons);
    const lastViewed = access.kind === "enrolled" ? await this.uow.repos.progress.lastViewedLessonId(access.enrollmentId) : null;
    const firstUnfinished = allLessons.find((lesson) => !lesson.completed)?.id ?? allLessons[0]?.id ?? null;

    return {
      modules,
      totalLessons: allLessons.length,
      completedLessons: allLessons.filter((lesson) => lesson.completed).length,
      percentage: allLessons.length === 0 ? 0 : Math.round((allLessons.filter((l) => l.completed).length / allLessons.length) * 100),
      resumeLessonId: lastViewed ?? firstUnfinished,
    };
  }

  /** Lesson plus its neighbours; opening it records the resume point. */
  async openLesson(organizationId: string, courseSlug: string, lessonId: string, access: MemberAccess) {
    const course = await this.getCourse(organizationId, courseSlug);
    const flat = course.modules.flatMap((module) => module.lessons.map((lesson) => ({ lesson, moduleTitle: module.title })));
    const index = flat.findIndex((item) => item.lesson.id === lessonId);
    if (index === -1) throw new NotFoundError("Lesson", lessonId);

    if (access.kind === "enrolled") {
      await this.uow.repos.progress.markViewed(access.enrollmentId, lessonId);
    }

    const progress = access.kind === "enrolled" ? await this.uow.repos.progress.listProgress(access.enrollmentId) : [];
    const current = progress.find((row) => row.lessonId === lessonId);

    return {
      course,
      lesson: flat[index].lesson,
      moduleTitle: flat[index].moduleTitle,
      completed: Boolean(current?.completedAt),
      previousLessonId: index > 0 ? flat[index - 1].lesson.id : null,
      nextLessonId: index < flat.length - 1 ? flat[index + 1].lesson.id : null,
    };
  }

  async setLessonCompleted(organizationId: string, courseSlug: string, lessonId: string, access: MemberAccess, completed: boolean) {
    if (access.kind !== "enrolled") throw new ForbiddenError("Apenas alunos matriculados registram progresso");
    const course = await this.getCourse(organizationId, courseSlug);
    const belongs = course.modules.some((module) => module.lessons.some((lesson) => lesson.id === lessonId));
    if (!belongs) throw new NotFoundError("Lesson", lessonId);
    await this.uow.repos.progress.setCompleted(access.enrollmentId, lessonId, completed);
  }

  /** Courses the student can open in an organization, with their progress. */
  async listForStudent(organizationId: string, user: { id: string; email: string }) {
    const courses = await this.uow.repos.courses.listPublished(organizationId);
    return Promise.all(
      courses.map(async (course) => {
        const access = await this.resolveAccess(course.id, user, organizationId);
        if (!access) return { course, unlocked: false, percentage: 0, completedLessons: 0, totalLessons: 0, preview: false };
        const outline = await this.outline(organizationId, course.slug, access);
        return {
          course,
          unlocked: true,
          percentage: outline.percentage,
          completedLessons: outline.completedLessons,
          totalLessons: outline.totalLessons,
          preview: access.kind === "preview",
        };
      }),
    );
  }
}
