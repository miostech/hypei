import type { LocaleTag } from "../locale";

/**
 * Dicionário do app do produtor, em português. Fonte da forma, como as outras famílias.
 *
 * Cresce por seção de rota, na ordem em que a barra lateral as mostra, para que achar a frase
 * na tela e achar a chave no arquivo sejam o mesmo movimento.
 */
const pt = {
  localeTag: "pt-BR" as LocaleTag,

  /** Como o idioma aparece no próprio seletor: sempre no idioma dele, nunca traduzido. */
  languageName: "Português",

  nav: {
    groups: {
      overview: "Visão geral",
      catalog: "Catálogo",
      customers: "Clientes",
      finance: "Financeiro",
      account: "Conta",
    },
    items: {
      dashboard: "Dashboard",
      sales: "Vendas",
      refunds: "Reembolsos",
      analytics: "Analytics",
      products: "Produtos",
      offers: "Ofertas",
      checkouts: "Checkout",
      coupons: "Cupons",
      customers: "Clientes",
      subscriptions: "Assinaturas",
      membersArea: "Área de membros",
      affiliates: "Afiliados",
      finance: "Financeiro",
      payouts: "Saques",
      verification: "Verificação",
      integrations: "Integrações",
      settings: "Configurações",
    },
    testEnvironment: "Ambiente de teste",
  },

  topbar: {
    organizations: "Suas organizações",
    newOrganization: "Nova organização",
    account: "Conta",
    myAccount: "Minha conta",
    settings: "Configurações",
    language: "Idioma",
    signOut: "Sair",
  },

  roles: {
    OWNER: "Proprietário",
    ADMIN: "Administrador",
    FINANCE: "Financeiro",
    SUPPORT: "Suporte",
    MARKETING: "Marketing",
    VIEWER: "Visualizador",
  },
};

export type AppDictionary = typeof pt;

export default pt;
