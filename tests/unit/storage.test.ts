import { describe, expect, it } from "vitest";
import { S3StorageProvider } from "@/lib/providers/storage/s3-storage-provider";
import { resolveStorageConfig } from "@/lib/providers/storage/storage-provider";

const HETZNER = {
  STORAGE_PROVIDER: "hetzner",
  STORAGE_BUCKET: "kabrun",
  STORAGE_ENDPOINT: "https://fsn1.your-objectstorage.com",
  STORAGE_ACCESS_KEY_ID: "a-key-id",
  STORAGE_SECRET_ACCESS_KEY: "a-secret",
};

describe("resolveStorageConfig", () => {
  it("takes the Hetzner region from the endpoint, so one variable moves the datacenter", () => {
    expect(resolveStorageConfig(HETZNER)).toMatchObject({ provider: "hetzner", region: "fsn1", forcePathStyle: false });
    expect(resolveStorageConfig({ ...HETZNER, STORAGE_ENDPOINT: "https://hel1.your-objectstorage.com" })).toMatchObject({ region: "hel1" });
  });

  it("lets an explicit region win over the endpoint", () => {
    expect(resolveStorageConfig({ ...HETZNER, STORAGE_REGION: "nbg1" })).toMatchObject({ region: "nbg1" });
  });

  /**
   * O painel da Hetzner mostra o endpoint sem protocolo. Copiado assim, o SDK estourava um
   * `Invalid URL` sem nome de variável, no primeiro upload e não ao subir a aplicação.
   */
  it("accepts the endpoint as the Hetzner panel shows it, without a scheme", () => {
    const bare = resolveStorageConfig({ ...HETZNER, STORAGE_ENDPOINT: "hel1.your-objectstorage.com" });
    expect(bare).toMatchObject({ endpoint: "https://hel1.your-objectstorage.com", region: "hel1" });
    expect(() => new URL(bare!.endpoint!)).not.toThrow();
  });
});

describe("S3StorageProvider", () => {
  /**
   * O upload vai do navegador direto para o bucket, e o corpo não existe na hora de assinar.
   * Com o padrão do SDK a URL sai carregando o CRC32 de um arquivo vazio e o bucket recusa o
   * vídeo de verdade. Este teste falha se alguém reativar a soma — o sintoma é um upload que
   * quebra em produção e funciona em todo lugar onde o provider é `local`.
   */
  it("signs an upload with no checksum for a body that does not exist yet", async () => {
    const provider = new S3StorageProvider(resolveStorageConfig(HETZNER)!);
    const target = await provider.createUpload({ key: "organizations/o1/courses/c1/aula.mp4", contentType: "video/mp4" });
    const url = new URL(target.url);

    expect(url.searchParams.get("x-amz-checksum-crc32")).toBeNull();
    expect([...url.searchParams.keys()].some((k) => k.startsWith("x-amz-checksum"))).toBe(false);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
  });

  it("addresses the bucket as a subdomain, the only style Hetzner serves", async () => {
    const provider = new S3StorageProvider(resolveStorageConfig(HETZNER)!);
    const target = await provider.createUpload({ key: "a/b.mp4", contentType: "video/mp4" });

    expect(new URL(target.url).host).toBe("kabrun.fsn1.your-objectstorage.com");
    expect(target.method).toBe("PUT");
    expect(target.headers["Content-Type"]).toBe("video/mp4");
  });
});
