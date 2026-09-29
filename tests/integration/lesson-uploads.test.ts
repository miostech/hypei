import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStorageProvider } from "@/lib/providers/storage";
import { createSeller, createTestApp, type TestApp } from "../support/test-app";

/** Course with one module, ready to receive lessons. */
async function courseWithModule(app: TestApp) {
  const seller = await createSeller(app);
  const course = await app.services.courses.create(seller.organization.id, seller.user.id, {
    productId: seller.product.id,
    title: "Curso",
    slug: "curso",
    description: "",
  });
  const courseModule = await app.services.courses.addModule(seller.organization.id, course.id, "Módulo");
  return { seller, course, moduleId: courseModule.id };
}

describe("Lesson uploads", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("authorizes an upload and keys it under the organization and course", async () => {
    const { seller, course, moduleId } = await courseWithModule(app);

    const target = await app.services.courses.createLessonUpload(seller.organization.id, moduleId, {
      filename: "aula-01.mp4",
      contentType: "video/mp4",
      sizeBytes: 50_000_000,
      type: "VIDEO",
    });

    expect(target.method).toBe("PUT");
    expect(target.key).toMatch(new RegExp(`^organizations/${seller.organization.id}/courses/${course.id}/[0-9a-f-]+\\.mp4$`));
    expect(app.storage.uploads).toHaveLength(1);
  });

  it("refuses a file that does not match the lesson type", async () => {
    const { seller, moduleId } = await courseWithModule(app);

    await expect(
      app.services.courses.createLessonUpload(seller.organization.id, moduleId, {
        filename: "planilha.xlsx",
        contentType: "application/vnd.ms-excel",
        sizeBytes: 1000,
        type: "VIDEO",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(app.storage.uploads).toHaveLength(0);
  });

  it("refuses a file over the limit for its type", async () => {
    const { seller, moduleId } = await courseWithModule(app);

    await expect(
      app.services.courses.createLessonUpload(seller.organization.id, moduleId, {
        filename: "podcast.mp3",
        contentType: "audio/mpeg",
        sizeBytes: 400_000_000,
        type: "AUDIO",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("never authorizes an upload into another organization's module", async () => {
    const a = await createSeller(app, { slug: "org-a" });
    const { moduleId } = await courseWithModule(app);

    await expect(
      app.services.courses.createLessonUpload(a.organization.id, moduleId, {
        filename: "aula.mp4",
        contentType: "video/mp4",
        sizeBytes: 1000,
        type: "VIDEO",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("stores the file on the lesson and drops the link it replaces", async () => {
    const { seller, moduleId } = await courseWithModule(app);

    const lesson = await app.services.courses.addLesson(seller.organization.id, moduleId, {
      title: "Aula com arquivo",
      type: "VIDEO",
      externalUrl: "https://video.example.com/antigo.mp4",
      storageKey: "organizations/x/courses/y/file.mp4",
      storageFilename: "aula-01.mp4",
      storageType: "video/mp4",
      storageBytes: 12_345,
    });

    expect(lesson).toMatchObject({
      storageKey: "organizations/x/courses/y/file.mp4",
      storageFilename: "aula-01.mp4",
      storageType: "video/mp4",
      storageBytes: 12_345,
      externalUrl: null,
    });
  });

  it("signs a download URL for a stored lesson and nothing for a linked one", async () => {
    expect(
      await app.services.courses.lessonMediaUrl({ storageKey: "keys/a.mp4", storageFilename: "a.mp4", type: "VIDEO" }),
    ).toContain("storage.test/object");
    expect(await app.services.courses.lessonMediaUrl({ storageKey: null, storageFilename: null, type: "VIDEO" })).toBeNull();
  });
});

describe("Local storage provider", () => {
  let directory: string;
  let provider: LocalStorageProvider;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "ripay-storage-"));
    provider = new LocalStorageProvider({ directory, appUrl: "https://app.ripay.test", secret: "test-secret" });
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("round-trips a file through signed URLs", async () => {
    const target = await provider.createUpload({ key: "courses/a/video.mp4", contentType: "video/mp4" });
    const params = new URL(target.url).searchParams;
    expect(provider.verify("put", { key: params.get("key")!, exp: params.get("exp")!, sig: params.get("sig")! })).toBe(true);

    await provider.write("courses/a/video.mp4", Buffer.from("conteudo"), "video/mp4");
    const stored = await provider.read("courses/a/video.mp4");
    expect(stored.body.toString()).toBe("conteudo");
    expect(stored.contentType).toBe("video/mp4");
    expect(await readFile(path.join(directory, "courses/a/video.mp4"), "utf8")).toBe("conteudo");
  });

  it("rejects a tampered signature, a different operation and an expired link", async () => {
    const target = await provider.createUpload({ key: "k/file.mp4", contentType: "video/mp4" });
    const params = new URL(target.url).searchParams;
    const valid = { key: params.get("key")!, exp: params.get("exp")!, sig: params.get("sig")! };

    expect(provider.verify("put", { ...valid, sig: `${valid.sig.slice(0, -2)}xx` })).toBe(false);
    expect(provider.verify("put", { ...valid, key: "k/outro.mp4" })).toBe(false);
    // A signature issued for uploading must not authorize reading.
    expect(provider.verify("get", valid)).toBe(false);
    expect(provider.verify("put", { ...valid, exp: String(Math.floor(Date.now() / 1000) - 10) })).toBe(false);
  });

  it("refuses to escape its own directory", async () => {
    expect(() => provider.resolve("../../etc/passwd")).toThrow(/Invalid storage key/);
    expect(() => provider.resolve("/etc/passwd")).toThrow(/Invalid storage key/);
    expect(provider.resolve("courses/a/file.mp4")).toContain(directory);
  });

  it("deletes the object and its metadata", async () => {
    await provider.write("k/file.mp4", Buffer.from("x"), "video/mp4");
    await provider.deleteObject("k/file.mp4");
    await expect(provider.read("k/file.mp4")).rejects.toThrow();
  });
});
