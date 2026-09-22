import type { DbClient } from "@/lib/database/postgres/client";
import type { Course, Lesson, Module } from "@/generated/prisma/client";

export type CourseWithContent = Course & { modules: (Module & { lessons: Lesson[] })[] };

export interface CourseRepository {
  listPublished(organizationId: string): Promise<Course[]>;
  findBySlug(organizationId: string, slug: string): Promise<CourseWithContent | null>;
  findByProductId(productId: string): Promise<Course | null>;
  hasEnrollment(courseId: string, email: string): Promise<boolean>;
  enroll(input: { courseId: string; customerId: string; orderId: string }): Promise<void>;
}

export class PrismaCourseRepository implements CourseRepository {
  constructor(private readonly db: DbClient) {}

  listPublished(organizationId: string) {
    return this.db.course.findMany({ where: { organizationId, published: true }, orderBy: { createdAt: "asc" } });
  }

  findBySlug(organizationId: string, slug: string) {
    return this.db.course.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
      include: { modules: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" } } } } },
    });
  }

  findByProductId(productId: string) {
    return this.db.course.findUnique({ where: { productId } });
  }

  async hasEnrollment(courseId: string, email: string) {
    const count = await this.db.enrollment.count({
      where: { courseId, status: "ACTIVE", customer: { email: email.toLowerCase() } },
    });
    return count > 0;
  }

  async enroll(input: { courseId: string; customerId: string; orderId: string }) {
    await this.db.enrollment.upsert({
      where: { courseId_customerId: { courseId: input.courseId, customerId: input.customerId } },
      create: input,
      update: { status: "ACTIVE" },
    });
  }
}
