import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A precedência de `requestLocale`: o que a URL pede agora, depois o que já foi pedido e ficou
 * no cookie, e só então o navegador. O cookie existe porque sem ele a escolha pela URL morreria
 * no primeiro clique — só a página que trouxe o parâmetro ficaria traduzida.
 */
const store = { cookie: null as string | null, acceptLanguage: null as string | null };

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (store.cookie && name === "kabrun_lang" ? { value: store.cookie } : undefined) }),
  headers: async () => ({ get: (name: string) => (name === "accept-language" ? store.acceptLanguage : null) }),
}));

const { requestLocale } = await import("@/lib/i18n/server");

describe("requestLocale", () => {
  beforeEach(() => {
    store.cookie = null;
    store.acceptLanguage = null;
  });

  it("prefers the ?lang= of this request over everything else", async () => {
    store.cookie = "it";
    store.acceptLanguage = "de";
    await expect(requestLocale("fr")).resolves.toBe("fr");
  });

  it("falls back to the language asked for earlier in the session", async () => {
    store.cookie = "it";
    store.acceptLanguage = "pt-BR";
    await expect(requestLocale(null)).resolves.toBe("it");
  });

  it("uses the browser when nothing was ever asked for", async () => {
    store.acceptLanguage = "es-ES,es;q=0.9";
    await expect(requestLocale(null)).resolves.toBe("es");
  });

  it("ignores a ?lang= or a cookie that is not a language we have", async () => {
    store.acceptLanguage = "de";
    await expect(requestLocale("klingon")).resolves.toBe("de");
    store.cookie = "klingon";
    await expect(requestLocale(null)).resolves.toBe("de");
  });

  it("ends in Portuguese when there is nothing to go on", async () => {
    await expect(requestLocale(null)).resolves.toBe("pt");
  });
});
