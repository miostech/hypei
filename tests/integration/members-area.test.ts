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

/**
 * Apagar cascateia para módulos, aulas, matrículas e progresso. É a única operação do editor
 * sem volta nem histórico, então a regra de quando ela é recusada importa mais que a de quando
 * ela funciona.
 */
describe("Apagar conteúdo", () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });

  async function courseWithLesson(app: TestApp, seller: Awaited<ReturnType<typeof createSeller>>) {
    const course = await app.services.courses.create(seller.organization.id, seller.user.id, {
      productId: seller.product.id,
      title: "Conteúdo",
      slug: `conteudo-${seller.organization.slug}`,
      description: "",
    });
    const courseModule = await app.services.courses.addModule(seller.organization.id, course.id, "Módulo");
    await app.services.courses.addLesson(seller.organization.id, courseModule!.id, lesson("Aula"));
    return course;
  }

  it("apaga o conteúdo, mantém o produto e libera ele para um conteúdo novo", async () => {
    const seller = await createSeller(app);
    const course = await courseWithLesson(app, seller);

    await app.services.courses.remove(seller.organization.id, seller.user.id, course.id);

    expect(await app.prisma.course.count({ where: { id: course.id } })).toBe(0);
    expect(await app.prisma.lesson.count()).toBe(0);
    expect(await app.prisma.product.count({ where: { id: seller.product.id } })).toBe(1);
    // É esta a razão de existir do botão: o produto errado deixava de ser utilizável.
    await expect(
      app.services.courses.create(seller.organization.id, seller.user.id, {
        productId: seller.product.id,
        title: "Conteúdo novo",
        slug: "conteudo-novo",
        description: "",
      }),
    ).resolves.toMatchObject({ productId: seller.product.id });
  });

  it("recusa quando alguém comprou, porque o progresso do aluno iria junto", async () => {
    const seller = await createSeller(app);
    const course = await courseWithLesson(app, seller);
    await app.services.courses.setPublished(seller.organization.id, seller.user.id, course.id, true);
    const { payment } = await startPurchase(app, seller.checkout.slug);
    await confirmPayment(app, payment);

    await expect(app.services.courses.remove(seller.organization.id, seller.user.id, course.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await app.prisma.course.count({ where: { id: course.id } })).toBe(1);
  });

  it("volta a permitir depois que o acesso foi revogado", async () => {
    const seller = await createSeller(app);
    const course = await courseWithLesson(app, seller);
    await app.services.courses.setPublished(seller.organization.id, seller.user.id, course.id, true);
    const { payment } = await startPurchase(app, seller.checkout.slug);
    await confirmPayment(app, payment);

    const enrollment = await app.prisma.enrollment.findFirstOrThrow({ where: { courseId: course.id } });
    await app.prisma.enrollment.update({ where: { id: enrollment.id }, data: { status: "REVOKED" } });

    await app.services.courses.remove(seller.organization.id, seller.user.id, course.id);
    expect(await app.prisma.course.count({ where: { id: course.id } })).toBe(0);
  });

  it("não apaga conteúdo de outra organização", async () => {
    const mine = await createSeller(app);
    const theirs = await createSeller(app);
    const course = await courseWithLesson(app, theirs);

    await expect(app.services.courses.remove(mine.organization.id, mine.user.id, course.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await app.prisma.course.count({ where: { id: course.id } })).toBe(1);
  });
});

/** Decide se o aviso de tradução aparece: quem só vende arquivo não tem o que traduzir. */
describe("Tem aula em vídeo", () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });

  async function courseWith(app: TestApp, seller: Awaited<ReturnType<typeof createSeller>>, type: "VIDEO" | "PDF") {
    const course = await app.services.courses.create(seller.organization.id, seller.user.id, {
      productId: seller.product.id,
      title: "Conteúdo",
      slug: `conteudo-${seller.organization.slug}`,
      description: "",
    });
    const courseModule = await app.services.courses.addModule(seller.organization.id, course.id, "Módulo");
    await app.services.courses.addLesson(seller.organization.id, courseModule!.id, {
      title: "Aula",
      type,
      externalUrl: "https://files.example.com/aula",
    });
    return course;
  }

  it("é falso sem conteúdo nenhum e sem aula nenhuma", async () => {
    const seller = await createSeller(app);
    expect(await app.services.courses.hasVideoLessons(seller.organization.id)).toBe(false);

    await app.services.courses.create(seller.organization.id, seller.user.id, {
      productId: seller.product.id,
      title: "Vazio",
      slug: "vazio",
      description: "",
    });
    expect(await app.services.courses.hasVideoLessons(seller.organization.id)).toBe(false);
  });

  it("é falso num ebook e verdadeiro quando há aula em vídeo", async () => {
    const pdf = await createSeller(app);
    await courseWith(app, pdf, "PDF");
    expect(await app.services.courses.hasVideoLessons(pdf.organization.id)).toBe(false);

    const video = await createSeller(app);
    await courseWith(app, video, "VIDEO");
    expect(await app.services.courses.hasVideoLessons(video.organization.id)).toBe(true);
    // A aula em vídeo de uma organização não acende o aviso na outra.
    expect(await app.services.courses.hasVideoLessons(pdf.organization.id)).toBe(false);
  });
});
