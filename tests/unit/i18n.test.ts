import { describe, expect, it } from "vitest";
import { getAppDictionary, languageOptions } from "@/lib/i18n/app";
import pt from "@/lib/i18n/app/pt";
import { getCheckoutDictionary } from "@/lib/i18n/checkout";
import { localizedCountries } from "@/lib/i18n/countries";
import { getEmailDictionary, storedLocale } from "@/lib/i18n/email";
import { DEFAULT_LOCALE, fill, plural, resolveLocale, SUPPORTED_LOCALES } from "@/lib/i18n/locale";
import { getMembersDictionary } from "@/lib/i18n/members";
import { SUPPORTED_COUNTRIES } from "@/modules/organizations/countries";
import {
  AffiliateCommissionStatus,
  DisputeStatus,
  LessonType,
  PayoutStatus,
  OrderStatus,
  OrganizationRole,
  PaymentMethodType,
  PaymentStatus,
  RefundStatus,
  SubscriptionStatus,
  TaxRegime,
  VerificationStatus,
} from "@/generated/prisma/enums";

/** Cada família de dicionário, pelo seu carregador. */
const FAMILIES = {
  checkout: getCheckoutDictionary,
  members: getMembersDictionary,
  email: getEmailDictionary,
  app: getAppDictionary,
} as const;

const OTHER_LOCALES = SUPPORTED_LOCALES.filter((locale) => locale !== "pt");

const placeholders = (value: unknown): string[] =>
  typeof value === "string" ? [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort() : [];

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

describe("plural", () => {
  it("picks the form and fills the count", () => {
    expect(plural("pt", 1, { one: "{count} pedido pago", other: "{count} pedidos pagos" })).toBe("1 pedido pago");
    expect(plural("pt", 3, { one: "{count} pedido pago", other: "{count} pedidos pagos" })).toBe("3 pedidos pagos");
  });

  it("treats zero as plural, except in French", () => {
    // "0 commande payée" é singular em francês; "0 pedidos pagos" é plural em português.
    expect(plural("pt", 0, { one: "{count} pedido", other: "{count} pedidos" })).toBe("0 pedidos");
    expect(plural("de", 0, { one: "{count} Bestellung", other: "{count} Bestellungen" })).toBe("0 Bestellungen");
    expect(plural("fr", 0, { one: "{count} commande", other: "{count} commandes" })).toBe("0 commande");
    expect(plural("fr", 2, { one: "{count} commande", other: "{count} commandes" })).toBe("2 commandes");
  });
});

describe("checkout dictionaries", () => {
  it("has one for every supported locale, in every family", async () => {
    for (const [family, load] of Object.entries(FAMILIES)) {
      for (const locale of SUPPORTED_LOCALES) {
        await expect(load(locale), `${family}/${locale}`).resolves.toBeTruthy();
      }
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
    const walk = (source: unknown, target: unknown, path: string) => {
      if (typeof source === "string") {
        expect(placeholders(target), path).toEqual(placeholders(source));
        return;
      }
      if (source && typeof source === "object") {
        for (const key of Object.keys(source)) {
          walk((source as Record<string, unknown>)[key], (target as Record<string, unknown>)[key], `${path}.${key}`);
        }
      }
    };

    for (const [family, load] of Object.entries(FAMILIES)) {
      const pt = await load("pt");
      for (const locale of OTHER_LOCALES) walk(pt, await load(locale), `${family}/${locale}`);
    }
  });

  it("names every role and every nav entry the producer shell can render", async () => {
    // A barra lateral e o cabeçalho leem por chave: uma chave faltando vira buraco na navegação.
    for (const locale of SUPPORTED_LOCALES) {
      const dict = await getAppDictionary(locale);
      for (const role of Object.values(OrganizationRole)) {
        expect(dict.roles[role], `${locale}/${role}`).toBeTruthy();
      }
      for (const [key, label] of Object.entries(dict.nav.items)) {
        expect(label, `${locale}/nav.items.${key}`).toBeTruthy();
      }
      for (const [key, label] of Object.entries(dict.nav.groups)) {
        expect(label, `${locale}/nav.groups.${key}`).toBeTruthy();
      }
    }
  });

  it("names every status the producer app can show", async () => {
    // Status sem nome vira "undefined" num selo colorido, que é pior do que sem selo.
    const ENUMS = {
      order: OrderStatus,
      payment: PaymentStatus,
      refund: RefundStatus,
      dispute: DisputeStatus,
      paymentMethod: PaymentMethodType,
    } as const;

    for (const locale of SUPPORTED_LOCALES) {
      const dict = await getAppDictionary(locale);
      for (const [group, values] of Object.entries(ENUMS)) {
        for (const value of Object.values(values)) {
          const labels: Record<string, string> = dict.status[group as keyof typeof ENUMS];
          expect(labels[value], `${locale}/status.${group}.${value}`).toBeTruthy();
        }
      }
    }
  });

  it("names every subscription and commission status the producer app can show", async () => {
    // Estes dois selos ficam fora de `dict.status`: moram na seção da própria tela.
    for (const locale of SUPPORTED_LOCALES) {
      const dict = await getAppDictionary(locale);
      for (const status of Object.values(SubscriptionStatus)) {
        expect(dict.subscriptions.statuses[status], `${locale}/subscriptions.statuses.${status}`).toBeTruthy();
      }
      for (const status of Object.values(AffiliateCommissionStatus)) {
        expect(dict.affiliates.statuses[status], `${locale}/affiliates.statuses.${status}`).toBeTruthy();
      }
      for (const status of Object.values(PayoutStatus)) {
        expect(dict.payouts.statuses[status], `${locale}/payouts.statuses.${status}`).toBeTruthy();
      }
      for (const regime of Object.values(TaxRegime)) {
        expect(dict.settings.taxRegimes[regime]?.label, `${locale}/settings.taxRegimes.${regime}`).toBeTruthy();
        expect(dict.settings.taxRegimes[regime]?.hint, `${locale}/settings.taxRegimes.${regime}.hint`).toBeTruthy();
      }
      for (const status of Object.values(VerificationStatus)) {
        const entry = dict.verification.statuses[status];
        expect(entry?.label, `${locale}/verification.statuses.${status}.label`).toBeTruthy();
        expect(entry?.description, `${locale}/verification.statuses.${status}.description`).toBeTruthy();
      }
    }
  });

  it("names every requirement code the provider mapping knows", async () => {
    // O produtor nunca deve ler "individual.verification.document": se um idioma esquecer um
    // código, é o código cru que aparece na lista de pendências dele.
    const codes = Object.keys(pt.verification.requirements);
    for (const locale of SUPPORTED_LOCALES) {
      const dict = await getAppDictionary(locale);
      for (const code of codes) {
        const entry = dict.verification.requirements[code as keyof typeof dict.verification.requirements];
        expect(entry?.label, `${locale}/verification.requirements.${code}`).toBeTruthy();
      }
    }
  });

  it("names every lesson type on both sides of the members area", async () => {
    // O aluno vê a sua lista e o produtor vê o seletor do editor: os dois dicionários nomeiam
    // os mesmos tipos, e um tipo novo no Prisma tem de aparecer nos dois.
    for (const locale of SUPPORTED_LOCALES) {
      const members = await getMembersDictionary(locale);
      const app = await getAppDictionary(locale);
      for (const type of Object.values(LessonType)) {
        expect(members.lessonTypes[type], `${locale}/members/${type}`).toBeTruthy();
        expect(app.membersArea.lessonTypes[type], `${locale}/app/${type}`).toBeTruthy();
      }
    }
  });

  it("does not leave a translation copied from the Portuguese", async () => {
    // "Pix", "Boleto", "Total" e companhia são iguais de propósito; frase inteira não é.
    const checkoutPt = await getCheckoutDictionary("pt");
    const membersPt = await getMembersDictionary("pt");
    const emailPt = await getEmailDictionary("pt");
    const appPt = await getAppDictionary("pt");

    for (const locale of OTHER_LOCALES) {
      const checkout = await getCheckoutDictionary(locale);
      expect(checkout.form.title, locale).not.toBe(checkoutPt.form.title);
      expect(checkout.summary.title, locale).not.toBe(checkoutPt.summary.title);
      expect(checkout.result.paid.body, locale).not.toBe(checkoutPt.result.paid.body);
      expect(checkout.errors.coupon.expired, locale).not.toBe(checkoutPt.errors.coupon.expired);

      const members = await getMembersDictionary(locale);
      expect(members.home.subtitle, locale).not.toBe(membersPt.home.subtitle);
      expect(members.lesson.downloadHint, locale).not.toBe(membersPt.lesson.downloadHint);

      const email = await getEmailDictionary(locale);
      expect(email.purchaseConfirmed.heading, locale).not.toBe(emailPt.purchaseConfirmed.heading);
      expect(email.footer.processedBy, locale).not.toBe(emailPt.footer.processedBy);

      const app = await getAppDictionary(locale);
      expect(app.topbar.organizations, locale).not.toBe(appPt.topbar.organizations);
      expect(app.nav.testEnvironment, locale).not.toBe(appPt.nav.testEnvironment);
      expect(app.roles.OWNER, locale).not.toBe(appPt.roles.OWNER);
      expect(app.dashboard.description, locale).not.toBe(appPt.dashboard.description);
      expect(app.sale.payment.taxNote, locale).not.toBe(appPt.sale.payment.taxNote);
      expect(app.refunds.disputes.description, locale).not.toBe(appPt.refunds.disputes.description);
      expect(app.status.order.PENDING_PAYMENT, locale).not.toBe(appPt.status.order.PENDING_PAYMENT);
    }
  });
});

describe("languageOptions", () => {
  it("offers every supported language, each written in itself", async () => {
    // O seletor é a única tela que uma pessoa lê num idioma que não é o dela: ela precisa
    // reconhecer "Deutsch" sem saber alemão. Traduzir os nomes acabaria com isso.
    const options = await languageOptions();
    expect(options.map((option) => option.locale)).toEqual([...SUPPORTED_LOCALES]);
    expect(options.map((option) => option.name)).toEqual(["Português", "English", "Español", "Français", "Deutsch", "Italiano"]);
  });
});

describe("storedLocale", () => {
  it("falls back to Portuguese for what the column does not carry", () => {
    // Quem comprou antes da coluna existir tem null, e o e-mail dele já era em português.
    expect(storedLocale(null)).toBe(DEFAULT_LOCALE);
    expect(storedLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(storedLocale("")).toBe(DEFAULT_LOCALE);
    expect(storedLocale("klingon")).toBe(DEFAULT_LOCALE);
  });

  it("accepts the language, and a full tag if one ever gets stored", () => {
    expect(storedLocale("de")).toBe("de");
    expect(storedLocale("es-ES")).toBe("es");
    expect(storedLocale("PT-BR")).toBe("pt");
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
