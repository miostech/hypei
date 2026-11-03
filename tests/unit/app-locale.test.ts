import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A precedência de `appLocale`. É outra que no checkout porque aqui existe conta: entre o
 * cookie da sessão e o palpite do navegador entra o `User.locale`, que é o que o produtor
 * escolheu no seletor — ou o que o Keycloak sabia dele no primeiro login.
 */
const store = {
  cookie: null as string | null,
  acceptLanguage: null as string | null,
  userLocale: null as string | null,
};

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (store.cookie && name === "kabrun_lang" ? { value: store.cookie } : undefined) }),
  headers: async () => ({ get: (name: string) => (name === "accept-language" ? store.acceptLanguage : null) }),
}));

vi.mock("@/modules/auth/current-user", () => ({
  getCurrentUser: async () => ({ id: "user_1", locale: store.userLocale }),
}));

const { appLocale } = await import("@/lib/i18n/app/server");

describe("appLocale", () => {
  beforeEach(() => {
    store.cookie = null;
    store.acceptLanguage = null;
    store.userLocale = null;
  });

  it("prefers the ?lang= of this request, so checking a screen never changes the account", async () => {
    store.cookie = "it";
    store.userLocale = "de";
    store.acceptLanguage = "en";
    await expect(appLocale("fr")).resolves.toBe("fr");
  });

  it("prefers the account over the browser", async () => {
    store.userLocale = "de";
    store.acceptLanguage = "pt-BR";
    await expect(appLocale()).resolves.toBe("de");
  });

  it("accepts a full tag in the column, which is what Keycloak sends", async () => {
    store.userLocale = "pt-BR";
    store.acceptLanguage = "en";
    await expect(appLocale()).resolves.toBe("pt");
  });

  it("ignores a stored language we do not have", async () => {
    store.userLocale = "klingon";
    store.acceptLanguage = "es-ES";
    await expect(appLocale()).resolves.toBe("es");
  });

  it("falls back to the browser, and then to Portuguese", async () => {
    store.acceptLanguage = "it-IT,it;q=0.9";
    await expect(appLocale()).resolves.toBe("it");
    store.acceptLanguage = null;
    await expect(appLocale()).resolves.toBe("pt");
  });
});
