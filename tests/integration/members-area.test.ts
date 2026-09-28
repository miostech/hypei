import { beforeEach, describe, expect, it } from "vitest";
import { confirmPayment, createSeller, createTestApp, startPurchase, type TestApp } from "../support/test-app";

const lesson = (title: string) => ({ title, type: "VIDEO" as const, externalUrl: "https://video.example.com/aula.mp4" });

describe("Members area editor", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("creates one course per product and keeps slugs unique per organization", async () => {
    const seller = await createSeller(app);
    const course = await app.services.courses.create(seller.organization.id, seller.user.id, {
      productId: seller.product.id,
      title: "Curso completo",
      slug: "curso-completo",
      description: "",
    });
    expect(course.published).toBe(false);

    await expect(
      app.services.courses.create(seller.organization.id, seller.user.id, {
        productId: seller.product.id,
        title: "Outro curso",
        slug: "outro-curso",
        description: "",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const another = await app.services.products.create(seller.organization.id, seller.user.id, {
      name: "Segundo produto",
      slug: "segundo-produto",
      type: "COURSE",
      status: "ACTIVE",
    });
    await expect(
      app.services.courses.create(seller.organization.id, seller.user.id, {
        productId: another.id,
        title: "Curso completo",
        slug: "curso-completo",
        description: "",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses to publish a course with no lessons", async () => {
    const seller = await createSeller(app);
    const course = await app.services.courses.create(seller.organization.id, seller.user.id, {
      productId: seller.product.id,
      title: "Curso",
      slug: "curso",
      description: "",
    });

    await expect(app.services.courses.setPublished(seller.organization.id, seller.user.id, course.id, true)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    const courseModule = await app.services.courses.addModule(seller.organization.id, course.id, "Módulo 1");
    await app.services.courses.addLesson(seller.organization.id, courseModule.id, lesson("Aula 1"));
    await app.services.courses.setPublished(seller.organization.id, seller.user.id, course.id, true);

    expect((await app.services.courses.get(seller.organization.id, course.id)).published).toBe(true);
    expect(await app.services.uow.repos.courses.listPublished(seller.organization.id)).toHaveLength(1);
  });

  it("keeps module and lesson positions contiguous when reordering and deleting", async () => {
    const seller = await createSeller(app);
    const course = await app.services.courses.create(seller.organization.id, seller.user.id, {
      productId: seller.product.id,
      title: "Curso",
      slug: "curso",
      description: "",
    });
    const org = seller.organization.id;

    const first = await app.services.courses.addModule(org, course.id, "Primeiro");
    const second = await app.services.courses.addModule(org, course.id, "Segundo");
    await app.services.courses.addModule(org, course.id, "Terceiro");

    await app.services.courses.moveModule(org, second.id, "up");
    let content = await app.services.courses.get(org, course.id);
    expect(content.modules.map((m) => m.title)).toEqual(["Segundo", "Primeiro", "Terceiro"]);

    await app.services.courses.removeModule(org, first.id);
    content = await app.services.courses.get(org, course.id);
    expect(content.modules.map((m) => m.position)).toEqual([1, 2]);

    const target = content.modules[0];
    await app.services.courses.addLesson(org, target.id, lesson("Aula 1"));
    const middle = await app.services.courses.addLesson(org, target.id, lesson("Aula 2"));
    await app.services.courses.addLesson(org, target.id, lesson("Aula 3"));

    await app.services.courses.moveLesson(org, middle.id, "down");
    content = await app.services.courses.get(org, course.id);
    expect(content.modules[0].lessons.map((l) => l.title)).toEqual(["Aula 1", "Aula 3", "Aula 2"]);

    await app.services.courses.removeLesson(org, middle.id);
    content = await app.services.courses.get(org, course.id);
    expect(content.modules[0].lessons.map((l) => l.position)).toEqual([1, 2]);
  });

  it("stores the lesson body for text lessons and the link for media lessons", async () => {
    const seller = await createSeller(app);
    const course = await app.services.courses.create(seller.organization.id, seller.user.id, {
      productId: seller.product.id,
      title: "Curso",
      slug: "curso",
      description: "",
    });
    const courseModule = await app.services.courses.addModule(seller.organization.id, course.id, "Módulo");

    const video = await app.services.courses.addLesson(seller.organization.id, courseModule.id, {
      title: "Aula em vídeo",
      type: "VIDEO",
      durationMinutes: 12,
      externalUrl: "https://video.example.com/aula.mp4",
      content: "isto deve ser ignorado",
    });
    const text = await app.services.courses.addLesson(seller.organization.id, courseModule.id, {
      title: "Aula em texto",
      type: "TEXT",
      content: "Conteúdo da aula",
      externalUrl: "https://ignorado.example.com",
    });

    expect(video).toMatchObject({ externalUrl: "https://video.example.com/aula.mp4", content: null, durationSeconds: 720 });
    expect(text).toMatchObject({ content: "Conteúdo da aula", externalUrl: null });
  });

  it("never lets one organization touch another's course, module or lesson", async () => {
    const a = await createSeller(app, { slug: "tenant-a" });
    const b = await createSeller(app, { slug: "tenant-b" });

    const course = await app.services.courses.create(b.organization.id, b.user.id, {
      productId: b.product.id,
      title: "Curso do B",
      slug: "curso-do-b",
      description: "",
    });
    const courseModule = await app.services.courses.addModule(b.organization.id, course.id, "Módulo do B");
    const lessonOfB = await app.services.courses.addLesson(b.organization.id, courseModule.id, lesson("Aula do B"));

    await expect(app.services.courses.get(a.organization.id, course.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      app.services.courses.create(a.organization.id, a.user.id, { productId: b.product.id, title: "x", slug: "x", description: "" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(app.services.courses.addModule(a.organization.id, course.id, "invadido")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(app.services.courses.renameModule(a.organization.id, courseModule.id, "invadido")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(app.services.courses.removeModule(a.organization.id, courseModule.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(app.services.courses.addLesson(a.organization.id, courseModule.id, lesson("invadida"))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(app.services.courses.updateLesson(a.organization.id, lessonOfB.id, lesson("invadida"))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(app.services.courses.removeLesson(a.organization.id, lessonOfB.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Nothing changed on B's side.
    const untouched = await app.services.courses.get(b.organization.id, course.id);
    expect(untouched.modules[0].title).toBe("Módulo do B");
    expect(untouched.modules[0].lessons[0].title).toBe("Aula do B");
  });

  it("gives access to buyers who paid before the course existed", async () => {
    const seller = await createSeller(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "antiga@example.com");
    await confirmPayment(app, payment);

    const course = await app.services.courses.create(seller.organization.id, seller.user.id, {
      productId: seller.product.id,
      title: "Curso criado depois",
      slug: "curso-depois",
      description: "",
    });

    expect(await app.services.uow.repos.courses.hasEnrollment(course.id, "antiga@example.com")).toBe(true);
  });

  it("enrolls the buyer in the course when the payment is confirmed", async () => {
    const seller = await createSeller(app);
    const course = await app.services.courses.create(seller.organization.id, seller.user.id, {
      productId: seller.product.id,
      title: "Curso",
      slug: "curso",
      description: "",
    });
    const courseModule = await app.services.courses.addModule(seller.organization.id, course.id, "Módulo");
    await app.services.courses.addLesson(seller.organization.id, courseModule.id, lesson("Aula 1"));
    await app.services.courses.setPublished(seller.organization.id, seller.user.id, course.id, true);

    expect(await app.services.uow.repos.courses.hasEnrollment(course.id, "aluna@example.com")).toBe(false);

    const { payment } = await startPurchase(app, seller.checkout.slug, "aluna@example.com");
    await confirmPayment(app, payment);

    expect(await app.services.uow.repos.courses.hasEnrollment(course.id, "aluna@example.com")).toBe(true);
    expect((await app.services.courses.list(seller.organization.id))[0]._count.enrollments).toBe(1);
  });
});
