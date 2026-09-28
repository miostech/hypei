import type { DbClient } from "@/lib/database/postgres/client";
import type { Enrollment, LessonProgress } from "@/generated/prisma/client";

export interface ProgressRepository {
  /** The student's active enrollment in a course, resolved by the e-mail they signed in with. */
  findEnrollment(courseId: string, email: string): Promise<Enrollment | null>;
  listProgress(enrollmentId: string): Promise<LessonProgress[]>;
  /** Records that the student opened the lesson, without touching `completedAt`. */
  markViewed(enrollmentId: string, lessonId: string): Promise<void>;
  setCompleted(enrollmentId: string, lessonId: string, completed: boolean): Promise<void>;
  /** Lesson the student touched most recently, used by "continuar de onde parei". */
  lastViewedLessonId(enrollmentId: string): Promise<string | null>;
}

export class PrismaProgressRepository implements ProgressRepository {
  constructor(private readonly db: DbClient) {}

  findEnrollment(courseId: string, email: string) {
    return this.db.enrollment.findFirst({
      where: { courseId, status: "ACTIVE", customer: { email: email.toLowerCase() } },
    });
  }

  listProgress(enrollmentId: string) {
    return this.db.lessonProgress.findMany({ where: { enrollmentId } });
  }

  async markViewed(enrollmentId: string, lessonId: string) {
    await this.db.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
      create: { enrollmentId, lessonId },
      // Touch updatedAt so the lesson becomes the resume point.
      update: { updatedAt: new Date() },
    });
  }

  async setCompleted(enrollmentId: string, lessonId: string, completed: boolean) {
    const completedAt = completed ? new Date() : null;
    await this.db.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
      create: { enrollmentId, lessonId, completedAt },
      update: { completedAt },
    });
  }

  async lastViewedLessonId(enrollmentId: string) {
    const last = await this.db.lessonProgress.findFirst({
      where: { enrollmentId },
      orderBy: { updatedAt: "desc" },
      select: { lessonId: true },
    });
    return last?.lessonId ?? null;
  }
}
