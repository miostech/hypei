import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { randomUUID } from "node:crypto";
import type { LessonType } from "@/generated/prisma/enums";
import { buildStorageKey, type StorageProvider } from "@/lib/providers/storage";
import type { UnitOfWork } from "@/server/unit-of-work";
import type { CourseInput, CourseSettingsInput, LessonInput } from "./course.schemas";

/**
 * Content editor for the member area. Everything is scoped by organization, and the
 * course can only go live once it actually has a lesson — an empty course in the
 * member area looks like a broken purchase.
 */
/**
 * What each lesson type accepts. Limits are generous but finite: without them a
 * single upload could fill the bucket, and the producer would only find out from
 * the invoice.
 */
const UPLOAD_LIMITS: Partial<Record<LessonType, { accepts: string[]; maxBytes: number }>> = {
  VIDEO: { accepts: ["video/"], maxBytes: 2_000_000_000 },
  AUDIO: { accepts: ["audio/"], maxBytes: 300_000_000 },
  PDF: { accepts: ["application/pdf"], maxBytes: 100_000_000 },
  DOWNLOAD: { accepts: ["application/", "image/", "text/", "audio/", "video/"], maxBytes: 300_000_000 },
};

export class CourseService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly storage: StorageProvider,
  ) {}

  /**
   * Authorizes a direct upload to storage. The browser never chooses the object
   * key and never uploads through us: it asks here, gets a URL that expires, and
   * sends the bytes straight to the bucket.
   */
  async createLessonUpload(
    organizationId: string,
    moduleId: string,
    input: { filename: string; contentType: string; sizeBytes: number; type: LessonType },
  ) {
    const courseModule = await this.uow.repos.courses.findModule(organizationId, moduleId);
    if (!courseModule) throw new NotFoundError("Module", moduleId);

    const limit = UPLOAD_LIMITS[input.type];
    if (!limit) throw new ValidationError("Esta aula não aceita arquivo");
    if (input.sizeBytes <= 0) throw new ValidationError("Arquivo vazio");
    if (input.sizeBytes > limit.maxBytes) {
      throw new ValidationError(`O arquivo passa do limite de ${Math.round(limit.maxBytes / 1_000_000)} MB para este tipo de aula`);
    }
    if (!limit.accepts.some((prefix) => input.contentType.startsWith(prefix))) {
      throw new ValidationError("Formato de arquivo não aceito para este tipo de aula");
    }

    const key = buildStorageKey({
      organizationId,
      courseId: courseModule.courseId,
      filename: input.filename,
      id: randomUUID(),
    });
    const target = await this.storage.createUpload({ key, contentType: input.contentType });
    return { ...target, filename: input.filename.slice(0, 180), contentType: input.contentType, sizeBytes: input.sizeBytes };
  }

  /** Short-lived URL for playing or downloading a lesson stored in the bucket. */
  async lessonMediaUrl(lesson: { storageKey: string | null; storageFilename: string | null; type: LessonType }) {
    if (!lesson.storageKey) return null;
    return this.storage.getDownloadUrl({
      key: lesson.storageKey,
      downloadName: lesson.type === "DOWNLOAD" || lesson.type === "PDF" ? (lesson.storageFilename ?? undefined) : undefined,
    });
  }

  list(organizationId: string) {
    return this.uow.repos.courses.list(organizationId);
  }

  async get(organizationId: string, courseId: string) {
    const course = await this.uow.repos.courses.findById(organizationId, courseId);
    if (!course) throw new NotFoundError("Course", courseId);
    return course;
  }

  /** Products that can still receive a course (one course per product). */
  async availableProducts(organizationId: string) {
    const products = await this.uow.repos.products.list(organizationId);
    const taken = new Set((await this.uow.repos.courses.list(organizationId)).map((course) => course.productId));
    return products.filter((product) => !taken.has(product.id) && product.status !== "ARCHIVED");
  }

  async create(organizationId: string, userId: string, input: CourseInput) {
    return this.uow.transaction(async (repos) => {
      const product = await repos.products.findById(organizationId, input.productId);
      if (!product) throw new NotFoundError("Product", input.productId);
      if (await repos.courses.findByProductId(product.id)) {
        throw new ConflictError("Este produto já tem um curso", { field: "productId" });
      }
      if (await repos.courses.slugTaken(organizationId, input.slug)) {
        throw new ConflictError("Já existe um curso com este link", { field: "slug" });
      }

      const course = await repos.courses.create(organizationId, product.id, {
        title: input.title,
        slug: input.slug,
        description: input.description || null,
      });
      // Someone who already bought this product must not be locked out of the course.
      const backfilled = await repos.courses.enrollExistingBuyers(course.id, product.id);
      await repos.audit.record({
        organizationId,
        userId,
        action: "course.created",
        entity: "Course",
        entityId: course.id,
        metadata: { backfilledEnrollments: backfilled },
      });
      return course;
    });
  }

  async updateSettings(organizationId: string, userId: string, courseId: string, input: CourseSettingsInput) {
    return this.uow.transaction(async (repos) => {
      if (await repos.courses.slugTaken(organizationId, input.slug, courseId)) {
        throw new ConflictError("Já existe um curso com este link", { field: "slug" });
      }
      const course = await repos.courses.update(organizationId, courseId, {
        title: input.title,
        slug: input.slug,
        description: input.description || null,
      });
      if (!course) throw new NotFoundError("Course", courseId);
      await repos.audit.record({ organizationId, userId, action: "course.updated", entity: "Course", entityId: courseId });
      return course;
    });
  }

  async setPublished(organizationId: string, userId: string, courseId: string, published: boolean) {
    return this.uow.transaction(async (repos) => {
      const course = await repos.courses.findById(organizationId, courseId);
      if (!course) throw new NotFoundError("Course", courseId);
      const lessons = course.modules.reduce((total, module) => total + module.lessons.length, 0);
      if (published && lessons === 0) {
        throw new ValidationError("Publique o curso só depois de criar pelo menos uma aula");
      }
      await repos.courses.update(organizationId, courseId, { published });
      await repos.audit.record({
        organizationId,
        userId,
        action: published ? "course.published" : "course.unpublished",
        entity: "Course",
        entityId: courseId,
      });
      return { published };
    });
  }

  // ── Modules ──────────────────────────────────────────────────────────────
  async addModule(organizationId: string, courseId: string, title: string) {
    const created = await this.uow.repos.courses.createModule(organizationId, courseId, title);
    if (!created) throw new NotFoundError("Course", courseId);
    return created;
  }

  async renameModule(organizationId: string, moduleId: string, title: string) {
    if (!(await this.uow.repos.courses.updateModule(organizationId, moduleId, title))) {
      throw new NotFoundError("Module", moduleId);
    }
  }

  async removeModule(organizationId: string, moduleId: string) {
    if (!(await this.uow.repos.courses.deleteModule(organizationId, moduleId))) {
      throw new NotFoundError("Module", moduleId);
    }
  }

  async moveModule(organizationId: string, moduleId: string, direction: "up" | "down") {
    await this.uow.repos.courses.moveModule(organizationId, moduleId, direction);
  }

  // ── Lessons ──────────────────────────────────────────────────────────────
  async addLesson(organizationId: string, moduleId: string, input: LessonInput) {
    const created = await this.uow.repos.courses.createLesson(organizationId, moduleId, toLessonRecord(input));
    if (!created) throw new NotFoundError("Module", moduleId);
    return created;
  }

  async updateLesson(organizationId: string, lessonId: string, input: LessonInput) {
    if (!(await this.uow.repos.courses.updateLesson(organizationId, lessonId, toLessonRecord(input)))) {
      throw new NotFoundError("Lesson", lessonId);
    }
  }

  async removeLesson(organizationId: string, lessonId: string) {
    if (!(await this.uow.repos.courses.deleteLesson(organizationId, lessonId))) {
      throw new NotFoundError("Lesson", lessonId);
    }
  }

  async moveLesson(organizationId: string, lessonId: string, direction: "up" | "down") {
    await this.uow.repos.courses.moveLesson(organizationId, lessonId, direction);
  }
}

function toLessonRecord(input: LessonInput) {
  const isText = input.type === "TEXT";
  // An uploaded file wins over a pasted link: the producer just replaced one.
  const uploaded = !isText && input.storageKey ? input.storageKey : null;

  return {
    title: input.title,
    type: input.type,
    durationSeconds: input.durationMinutes ? input.durationMinutes * 60 : null,
    externalUrl: isText || uploaded ? null : input.externalUrl || null,
    content: isText ? input.content || null : null,
    storageKey: uploaded,
    storageFilename: uploaded ? input.storageFilename || null : null,
    storageType: uploaded ? input.storageType || null : null,
    storageBytes: uploaded ? (input.storageBytes ?? null) : null,
  };
}
