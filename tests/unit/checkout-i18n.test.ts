import { describe, expect, it } from "vitest";
import { getCheckoutDictionary } from "@/lib/i18n/checkout";
import { localizedCountries } from "@/lib/i18n/countries";
import { DEFAULT_LOCALE, fill, resolveLocale, SUPPORTED_LOCALES } from "@/lib/i18n/locale";
import { SUPPORTED_COUNTRIES } from "@/modules/organizations/countries";
import { PaymentMethodType } from "@/generated/prisma/enums";

describe("resolveLocale", () => {
  it("picks the highest q, not the first tag", () => {
    // Um espanhol bilíngue manda o inglês primeiro com peso menor; ler na ordem daria inglês.
    expect(resolveLocale("en;q=0.3, es;q=0.9")).toBe("es");
  });

  it("matches on the primary subtag, so regional variants land in the same dictionary", () => {
    expect(resolveLocale("es-419")).toBe("es");
    expect(resolveLocale("pt-PT,pt;q=0.9")).toBe("pt");
    expect(resolveLocale("en-GB")).toBe("en");
  });

  it("skips languages we do not have and falls back to Portuguese", () => {
    expect(resolveLocale("ja,ko;q=0.8")).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("nl-NL,nl;q=0.9,de;q=0.4")).toBe("de");
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("*")).toBe(DEFAULT_LOCALE);
  });

  it("treats q=0 as refused", () => {
    expect(resolveLocale("de;q=0, fr;q=0.1")).toBe("fr");
  });
});

describe("fill", () => {
  it("replaces every occurrence of a placeholder", () => {
    expect(fill("{a} e {a}, não {b}", { a: "um", b: "dois" })).toBe("um e um, não dois");
  });

  it("leaves an unfilled placeholder visible instead of blanking the sentence", () => {
    expect(fill("Garantia de {days} dias", {})).toBe("Garantia de {days} dias");
  });

  it("accepts numbers, which is what guaranteeDays is", () => {
    expect(fill("Garantia de {days} dias", { days: 7 })).toBe("Garantia de 7 dias");
  });
});

describe("checkout dictionaries", () => {
  it("has one for every supported locale", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      await expect(getCheckoutDictionary(locale)).resolves.toBeTruthy();
    }
  });

  it("names every payment method the resolver can offer", async () => {
    // Faltar um nome aqui deixaria "undefined" na lista de meios de pagamento do comprador.
    for (const locale of SUPPORTED_LOCALES) {
      const dict = await getCheckoutDictionary(locale);
      for (const method of Object.values(PaymentMethodType)) {
        expect(dict.methodNames[method], `${locale}/${method}`).toBeTruthy();
      }
    }
  });

  it("keeps every placeholder that the Portuguese source declares", async () => {
    // Tradução que perde o {amount} manda o comprador pagar sem ver quanto.
    const placeholders = (value: unknown): string[] =>
      typeof value === "string" ? [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort() : [];

    const walk = (source: unknown, target: unknown, path: string) => {
      if (typeof source === "string") {
        expect(placeholders(target), path).toEqual(placeholders(source));
        return;
      }
      if (source && typeof source === "object") {
        for (const key of Object.keys(source)) {
          walk(
            (source as Record<string, unknown>)[key],
            (target as Record<string, unknown>)[key],
            `${path}.${key}`,
          );
        }
      }
    };

    const pt = await getCheckoutDictionary("pt");
    for (const locale of SUPPORTED_LOCALES.filter((l) => l !== "pt")) {
      walk(pt, await getCheckoutDictionary(locale), locale);
    }
  });

  it("does not leave a translation copied from the Portuguese", async () => {
    const pt = await getCheckoutDictionary("pt");
    for (const locale of SUPPORTED_LOCALES.filter((l) => l !== "pt")) {
      const dict = await getCheckoutDictionary(locale);
      // "Pix", "Boleto", "Total" e companhia são iguais de propósito; frase inteira não é.
      expect(dict.form.title, locale).not.toBe(pt.form.title);
      expect(dict.summary.title, locale).not.toBe(pt.summary.title);
      expect(dict.result.paid.body, locale).not.toBe(pt.result.paid.body);
      expect(dict.errors.coupon.expired, locale).not.toBe(pt.errors.coupon.expired);
    }
  });
});

describe("localizedCountries", () => {
  it("names the markets in the buyer's language", () => {
    const names = (tag: string) => Object.fromEntries(localizedCountries(tag).map((c) => [c.code, c.name]));
    expect(names("de").DE).toBe("Deutschland");
    expect(names("fr").ES).toBe("Espagne");
    expect(names("en").BR).toBe("Brazil");
    expect(names("pt-BR").US).toBe("Estados Unidos");
  });

  it("keeps every supported market and sorts by the buyer's alphabet", () => {
    const list = localizedCountries("de");
    expect(list.map((c) => c.code).sort()).toEqual([...SUPPORTED_COUNTRIES].sort());
    expect(list[0].name).toBe("Brasilien");
    expect(list.at(-1)?.name).toBe("Vereinigte Staaten");
  });
});
