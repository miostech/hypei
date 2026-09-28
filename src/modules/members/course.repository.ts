import type { DbClient } from "@/lib/database/postgres/client";
import type { Course, Lesson, LessonType, Module, Product } from "@/generated/prisma/client";

export type CourseWithContent = Course & { modules: (Module & { lessons: Lesson[] })[] };
export type CourseListItem = Course & { product: Pick<Product, "id" | "name" | "status">; _count: { modules: number; enrollments: number } };

export interface CourseWriteRecord {
  title: string;
  slug: string;
  description: string | null;
}

export interface LessonWriteRecord {
  title: string;
  type: LessonType;
  durationSeconds: number | null;
  externalUrl: string | null;
  content: string | null;
}

/**
 * Modules and lessons have no organizationId of their own: every write walks up to the
 * course and matches the tenant there, so a foreign id can never be edited.
 */
export interface CourseRepository {
  list(organizationId: string): Promise<CourseListItem[]>;
  listPublished(organizationId: string): Promise<Course[]>;
  findById(organizationId: string, courseId: string): Promise<CourseWithContent | null>;
  findBySlug(organizationId: string, slug: string): Promise<CourseWithContent | null>;
  findByProductId(productId: string): Promise<Course | null>;
  slugTaken(organizationId: string, slug: string, exceptId?: string): Promise<boolean>;
  create(organizationId: string, productId: string, record: CourseWriteRecord): Promise<Course>;
  update(organizationId: string, courseId: string, record: Partial<CourseWriteRecord & { published: boolean }>): Promise<Course | null>;

  createModule(organizationId: string, courseId: string, title: string): Promise<Module | null>;
  updateModule(organizationId: string, moduleId: string, title: string): Promise<boolean>;
  deleteModule(organizationId: string, moduleId: string): Promise<boolean>;
  /** Swaps a module with its neighbour, keeping positions contiguous. */
  moveModule(organizationId: string, moduleId: string, direction: "up" | "down"): Promise<boolean>;

  createLesson(organizationId: string, moduleId: string, record: LessonWriteRecord): Promise<Lesson | null>;
  updateLesson(organizationId: string, lessonId: string, record: LessonWriteRecord): Promise<boolean>;
  deleteLesson(organizationId: string, lessonId: string): Promise<boolean>;
  moveLesson(organizationId: string, lessonId: string, direction: "up" | "down"): Promise<boolean>;

  countEnrollments(courseId: string): Promise<number>;
  hasEnrollment(courseId: string, email: string): Promise<boolean>;
  enroll(input: { courseId: string; customerId: string; orderId: string }): Promise<void>;
  /** Grants access to everyone who already paid for the product before the course existed. */
  enrollExistingBuyers(courseId: string, productId: string): Promise<number>;
}

const contentInclude = { modules: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" } } } } } as const;

export class PrismaCourseRepository implements CourseRepository {
  constructor(private readonly db: DbClient) {}

  list(organizationId: string) {
    return this.db.course.findMany({
      where: { organizationId },
      include: { product: { select: { id: true, name: true, status: true } }, _count: { select: { modules: true, enrollments: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  listPublished(organizationId: string) {
    return this.db.course.findMany({ where: { organizationId, published: true }, orderBy: { createdAt: "asc" } });
  }

  findById(organizationId: string, courseId: string) {
    return this.db.course.findFirst({ where: { id: courseId, organizationId }, include: contentInclude });
  }

  findBySlug(organizationId: string, slug: string) {
    return this.db.course.findUnique({ where: { organizationId_slug: { organizationId, slug } }, include: contentInclude });
  }

  findByProductId(productId: string) {
    return this.db.course.findUnique({ where: { productId } });
  }

  async slugTaken(organizationId: string, slug: string, exceptId?: string) {
    const count = await this.db.course.count({
      where: { organizationId, slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    });
    return count > 0;
  }

  create(organizationId: string, productId: string, record: CourseWriteRecord) {
    return this.db.course.create({ data: { ...record, organizationId, productId } });
  }

  async update(organizationId: string, courseId: string, record: Partial<CourseWriteRecord & { published: boolean }>) {
    const result = await this.db.course.updateMany({ where: { id: courseId, organizationId }, data: record });
    if (result.count === 0) return null;
    return this.db.course.findFirst({ where: { id: courseId, organizationId } });
  }

  // ── Modules ──────────────────────────────────────────────────────────────
  async createModule(organizationId: string, courseId: string, title: string) {
    const course = await this.db.course.findFirst({ where: { id: courseId, organizationId }, select: { id: true } });
    if (!course) return null;
    const last = await this.db.module.findFirst({ where: { courseId }, orderBy: { position: "desc" }, select: { position: true } });
    return this.db.module.create({ data: { courseId, title, position: (last?.position ?? 0) + 1 } });
  }

  private ownedModule(organizationId: string, moduleId: string) {
    return this.db.module.findFirst({ where: { id: moduleId, course: { organizationId } }, select: { id: true, courseId: true, position: true } });
  }

  async updateModule(organizationId: string, moduleId: string, title: string) {
    if (!(await this.ownedModule(organizationId, moduleId))) return false;
    await this.db.module.update({ where: { id: moduleId }, data: { title } });
    return true;
  }

  async deleteModule(organizationId: string, moduleId: string) {
    const found = await this.ownedModule(organizationId, moduleId);
    if (!found) return false;
    await this.db.module.delete({ where: { id: moduleId } });
    await this.compactModulePositions(found.courseId);
    return true;
  }

  async moveModule(organizationId: string, moduleId: string, direction: "up" | "down") {
    const current = await this.ownedModule(organizationId, moduleId);
    if (!current) return false;
    const neighbour = await this.db.module.findFirst({
      where: {
        courseId: current.courseId,
        position: direction === "up" ? { lt: current.position } : { gt: current.position },
      },
      orderBy: { position: direction === "up" ? "desc" : "asc" },
      select: { id: true, position: true },
    });
    if (!neighbour) return false;
    await this.db.$transaction([
      this.db.module.update({ where: { id: current.id }, data: { position: neighbour.position } }),
      this.db.module.update({ where: { id: neighbour.id }, data: { position: current.position } }),
    ]);
    return true;
  }

  private async compactModulePositions(courseId: string) {
    const modules = await this.db.module.findMany({ where: { courseId }, orderBy: { position: "asc" }, select: { id: true } });
    await this.db.$transaction(modules.map((m, index) => this.db.module.update({ where: { id: m.id }, data: { position: index + 1 } })));
  }

  // ── Lessons ──────────────────────────────────────────────────────────────
  async createLesson(organizationId: string, moduleId: string, record: LessonWriteRecord) {
    if (!(await this.ownedModule(organizationId, moduleId))) return null;
    const last = await this.db.lesson.findFirst({ where: { moduleId }, orderBy: { position: "desc" }, select: { position: true } });
    return this.db.lesson.create({ data: { ...record, moduleId, position: (last?.position ?? 0) + 1 } });
  }

  private ownedLesson(organizationId: string, lessonId: string) {
    return this.db.lesson.findFirst({
      where: { id: lessonId, module: { course: { organizationId } } },
      select: { id: true, moduleId: true, position: true },
    });
  }

  async updateLesson(organizationId: string, lessonId: string, record: LessonWriteRecord) {
    if (!(await this.ownedLesson(organizationId, lessonId))) return false;
    await this.db.lesson.update({ where: { id: lessonId }, data: record });
    return true;
  }

  async deleteLesson(organizationId: string, lessonId: string) {
    const found = await this.ownedLesson(organizationId, lessonId);
    if (!found) return false;
    await this.db.lesson.delete({ where: { id: lessonId } });
    const lessons = await this.db.lesson.findMany({ where: { moduleId: found.moduleId }, orderBy: { position: "asc" }, select: { id: true } });
    await this.db.$transaction(lessons.map((l, index) => this.db.lesson.update({ where: { id: l.id }, data: { position: index + 1 } })));
    return true;
  }

  async moveLesson(organizationId: string, lessonId: string, direction: "up" | "down") {
    const current = await this.ownedLesson(organizationId, lessonId);
    if (!current) return false;
    const neighbour = await this.db.lesson.findFirst({
      where: {
        moduleId: current.moduleId,
        position: direction === "up" ? { lt: current.position } : { gt: current.position },
      },
      orderBy: { position: direction === "up" ? "desc" : "asc" },
      select: { id: true, position: true },
    });
    if (!neighbour) return false;
    await this.db.$transaction([
      this.db.lesson.update({ where: { id: current.id }, data: { position: neighbour.position } }),
      this.db.lesson.update({ where: { id: neighbour.id }, data: { position: current.position } }),
    ]);
    return true;
  }

  // ── Enrollment ───────────────────────────────────────────────────────────
  countEnrollments(courseId: string) {
    return this.db.enrollment.count({ where: { courseId, status: "ACTIVE" } });
  }

  async hasEnrollment(courseId: string, email: string) {
    const count = await this.db.enrollment.count({
      where: { courseId, status: "ACTIVE", customer: { email: email.toLowerCase() } },
    });
    return count > 0;
  }

  async enrollExistingBuyers(courseId: string, productId: string) {
    const orders = await this.db.order.findMany({
      where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, items: { some: { offer: { productId } } } },
      select: { id: true, customerId: true },
      distinct: ["customerId"],
    });
    if (orders.length === 0) return 0;
    const result = await this.db.enrollment.createMany({
      data: orders.map((order) => ({ courseId, customerId: order.customerId, orderId: order.id })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async enroll(input: { courseId: string; customerId: string; orderId: string }) {
    await this.db.enrollment.upsert({
      where: { courseId_customerId: { courseId: input.courseId, customerId: input.customerId } },
      create: input,
      update: { status: "ACTIVE" },
    });
  }
}
