import { beforeEach, describe, expect, it } from "vitest";
import { confirmPayment, createSeller, createTestApp, startPurchase, type TestApp } from "../support/test-app";

const media = { type: "VIDEO" as const, externalUrl: "https://video.example.com/aula.mp4" };

/** Publishes a course with two lessons and sells it to `email`. */
async function publishedCourseWithStudent(app: TestApp, email = "aluna@example.com") {
  const seller = await createSeller(app);
  const org = seller.organization.id;
  const course = await app.services.courses.create(org, seller.user.id, {
    productId: seller.product.id,
    title: "Curso",
    slug: "curso",
    description: "",
  });
  const courseModule = await app.services.courses.addModule(org, course.id, "Módulo 1");
  const first = await app.services.courses.addLesson(org, courseModule.id, { title: "Aula 1", ...media });
  const second = await app.services.courses.addLesson(org, courseModule.id, { title: "Aula 2", ...media });
  await app.services.courses.setPublished(org, seller.user.id, course.id, true);

  const { payment } = await startPurchase(app, seller.checkout.slug, email);
  await confirmPayment(app, payment);

  const student = { id: "student-user", email };
  const access = await app.services.memberArea.resolveAccess(course.id, student, org);
  return { seller, org, course, first, second, student, access: access! };
}

describe("Member area progress", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("gives buyers enrolled access and team members a preview", async () => {
    const { seller, org, course, student } = await publishedCourseWithStudent(app);

    expect(await app.services.memberArea.resolveAccess(course.id, student, org)).toMatchObject({ kind: "enrolled" });
    expect(await app.services.memberArea.resolveAccess(course.id, { id: seller.user.id, email: seller.user.email }, org)).toEqual({
      kind: "preview",
    });
    expect(await app.services.memberArea.resolveAccess(course.id, { id: "estranho", email: "estranho@example.com" }, org)).toBeNull();
  });

  it("tracks completion and the course percentage", async () => {
    const { org, first, second, access } = await publishedCourseWithStudent(app);

    let outline = await app.services.memberArea.outline(org, "curso", access);
    expect(outline).toMatchObject({ totalLessons: 2, completedLessons: 0, percentage: 0 });

    await app.services.memberArea.setLessonCompleted(org, "curso", first.id, access, true);
    outline = await app.services.memberArea.outline(org, "curso", access);
    expect(outline).toMatchObject({ completedLessons: 1, percentage: 50 });

    await app.services.memberArea.setLessonCompleted(org, "curso", second.id, access, true);
    outline = await app.services.memberArea.outline(org, "curso", access);
    expect(outline.percentage).toBe(100);

    // Undoing works too.
    await app.services.memberArea.setLessonCompleted(org, "curso", second.id, access, false);
    expect((await app.services.memberArea.outline(org, "curso", access)).percentage).toBe(50);
  });

  it("resumes at the last opened lesson", async () => {
    const { org, first, second, access } = await publishedCourseWithStudent(app);

    // Before opening anything, the resume point is the first unfinished lesson.
    expect((await app.services.memberArea.outline(org, "curso", access)).resumeLessonId).toBe(first.id);

    await app.services.memberArea.openLesson(org, "curso", second.id, access);
    expect((await app.services.memberArea.outline(org, "curso", access)).resumeLessonId).toBe(second.id);

    const view = await app.services.memberArea.openLesson(org, "curso", first.id, access);
    expect(view).toMatchObject({ completed: false, previousLessonId: null, nextLessonId: second.id });
    expect((await app.services.memberArea.outline(org, "curso", access)).resumeLessonId).toBe(first.id);
  });

  it("never records progress for a team preview", async () => {
    const { seller, org, first, course } = await publishedCourseWithStudent(app);
    const preview = (await app.services.memberArea.resolveAccess(course.id, { id: seller.user.id, email: seller.user.email }, org))!;

    await app.services.memberArea.openLesson(org, "curso", first.id, preview);
    await expect(app.services.memberArea.setLessonCompleted(org, "curso", first.id, preview, true)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await app.prisma.lessonProgress.count()).toBe(0);
  });

  it("hides unpublished courses and lessons from other courses", async () => {
    const { org, access, seller } = await publishedCourseWithStudent(app);
    await app.services.courses.setPublished(org, seller.user.id, (await app.services.courses.list(org))[0].id, false);

    await expect(app.services.memberArea.getCourse(org, "curso")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(app.services.memberArea.openLesson(org, "curso", "outra-aula", access)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
