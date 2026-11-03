import type { Locale, LocaleTag } from "../locale";

/**
 * Dicionário do app do produtor, em português. Fonte da forma, como as outras famílias.
 *
 * Cresce por seção de rota, na ordem em que a barra lateral as mostra, para que achar a frase
 * na tela e achar a chave no arquivo sejam o mesmo movimento.
 */
const pt = {
  /** Serve ao `plural`, que precisa do idioma e nem sempre tem mais que o dicionário em mãos. */
  locale: "pt" as Locale,

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

  common: {
    date: "Data",
    customer: "Cliente",
    product: "Produto",
    status: "Status",
    amount: "Valor",
    order: "Pedido",
    payment: "Pagamento",
    reason: "Motivo",
    total: "Total",
    discount: "Desconto",
    cancel: "Cancelar",
    search: "Buscar",
    clear: "Limpar",
  },

  /** O que os enums do banco viram na tela. A cor do selo fica no código; aqui só o texto. */
  status: {
    order: {
      CREATED: "Criado",
      PENDING_PAYMENT: "Aguardando",
      PAID: "Pago",
      CANCELED: "Cancelado",
      REFUNDED: "Reembolsado",
      PARTIALLY_REFUNDED: "Reembolso parcial",
    },
    payment: {
      CREATED: "Criado",
      PENDING: "Pendente",
      PROCESSING: "Processando",
      AUTHORIZED: "Autorizado",
      PAID: "Pago",
      FAILED: "Falhou",
      CANCELED: "Cancelado",
      REFUNDED: "Reembolsado",
      PARTIALLY_REFUNDED: "Reembolso parcial",
      CHARGEBACK: "Chargeback",
    },
    refund: {
      REQUESTED: "Solicitado",
      PROCESSING: "Processando",
      PAID: "Devolvido",
      FAILED: "Falhou",
    },
    dispute: {
      OPEN: "Aberta",
      UNDER_REVIEW: "Em análise",
      WON: "Ganha",
      LOST: "Perdida",
      CLOSED: "Encerrada",
    },
    paymentMethod: {
      CREDIT_CARD: "Cartão de crédito",
      DEBIT_CARD: "Cartão de débito",
      PIX: "Pix",
      BOLETO: "Boleto",
      SEPA_DEBIT: "Débito SEPA",
      BANK_TRANSFER: "Transferência bancária",
      APPLE_PAY: "Apple Pay",
      GOOGLE_PAY: "Google Pay",
      PAYPAL: "PayPal",
    },
  },

  dashboard: {
    title: "Dashboard",
    eyebrow: "Painel",
    greeting: "Olá, {name}",
    description: "Como está o seu dia e o que precisa da sua atenção. O saldo fica no Financeiro.",
    viewCheckouts: "Ver checkouts",
    newProduct: "Novo produto",
    today: {
      label: "Vendas de hoje",
      none: "Nenhum pagamento confirmado ainda hoje.",
      newStudents: { one: "{count} novo aluno", other: "{count} novos alunos" },
      paidOrders: { one: "{count} pedido pago", other: "{count} pedidos pagos" },
      versusYesterday: "{percent}% vs. ontem",
      yesterdayUntilNow: "Ontem até esta hora",
      averageTicket: "Ticket médio hoje",
      viewSales: "Ver vendas",
      viewFinance: "Ver financeiro",
    },
    salesWindow: "Vendas ({days} dias)",
    averageTicket: "Ticket médio",
    samePeriod: "No mesmo período",
    chart: {
      title: "Vendas confirmadas",
      description: "Volume pago por dia nos últimos {days} dias.",
      emptyTitle: "Ainda sem vendas no período",
      emptyBody: "O gráfico aparece assim que o primeiro pagamento for confirmado.",
    },
    steps: {
      title: "Próximos passos",
      description: "Deixe sua operação pronta para vender.",
      product: "Criar seu primeiro produto",
      offer: "Definir uma oferta e preço",
      checkout: "Publicar um checkout",
      verification: "Concluir verificação para receber",
    },
    recent: {
      title: "Vendas recentes",
      description: "Os últimos pedidos criados no seu checkout.",
      viewAll: "Ver todas",
      emptyTitle: "Nenhuma venda ainda",
      emptyBody: "Crie um produto, publique um checkout e compartilhe o link para começar a vender.",
      createCheckout: "Criar checkout",
    },
  },

  sales: {
    title: "Vendas",
    description: "Pedidos criados no checkout e o status do pagamento de cada um.",
    searchPlaceholder: "Buscar por cliente, e-mail, produto ou referência…",
    searchLabel: "Buscar vendas",
    notFoundTitle: "Nenhuma venda encontrada",
    notFoundBody: "Nada corresponde a “{query}”. Tente o e-mail do cliente, o nome do produto ou a referência do pedido.",
    viewAll: "Ver todas as vendas",
    emptyTitle: "Nenhuma venda registrada",
    emptyBody: "Assim que alguém iniciar uma compra no seu checkout, o pedido aparece aqui.",
    viewCheckouts: "Ver checkouts",
  },

  sale: {
    title: "Venda",
    fallbackProduct: "Pedido",
    allSales: "Todas as vendas",
    /** Frase inteira por status: minúscula imposta no código quebra em alemão, onde o substantivo é maiúsculo. */
    disputeOpen: {
      OPEN: "Contestação aberta",
      UNDER_REVIEW: "Contestação em análise",
    },
    disputeHeld: "{amount} retidos",
    disputeDeadline: "prazo para provas até {date}",
    viewDisputes: "Ver contestações",
    payment: {
      title: "Pagamento",
      description: "Valores cobrados do cliente e o que sobra para você.",
      charged: "Valor cobrado",
      processorFee: "Taxa do processador",
      platformFee: "Taxa Kabrun",
      net: "Você recebe",
      refunded: "Já reembolsado",
      taxIncluded: "Tributo incluso · {regime}",
      method: "Forma de pagamento",
      paidAt: "Pago em",
      settledAt: "Liberado em",
      settlesAt: "Libera em",
      taxNote: "O tributo já está dentro do valor cobrado e não sai do que você recebe — o recolhimento é seu.",
      none: "Este pedido ainda não gerou pagamento.",
    },
    refunds: {
      title: "Reembolsos",
      description: "Devoluções solicitadas para esta venda.",
      empty: "Nenhum reembolso nesta venda.",
    },
    customer: {
      title: "Cliente",
      view: "Ver cliente",
    },
    order: {
      title: "Pedido",
      reference: "Referência",
      createdAt: "Criado em {date}",
    },
  },

  refundDialog: {
    trigger: "Reembolsar",
    title: "Reembolsar pagamento",
    description: "O valor volta para o cliente e sai do seu saldo.",
    partialNote: "Este pagamento já teve um reembolso parcial.",
    available: "Disponível para reembolso: {amount}.",
    full: "Valor total",
    partial: "Valor parcial",
    partialHint: "Você escolhe quanto devolver",
    amountLabel: "Valor a devolver",
    amountPlaceholder: "97,00",
    reasonLabel: "Motivo (opcional)",
    reasonPlaceholder: "Pedido da cliente, fora do prazo de garantia…",
    reasonHint: "Fica registrado no histórico da venda.",
    submitted: "Reembolso solicitado",
  },

  refunds: {
    title: "Reembolsos e contestações",
    description: "Devoluções que você fez e cobranças que o cliente contestou no banco ou no cartão.",
    refunded: "Reembolsado",
    refundedHint: { one: "{count} solicitação", other: "{count} solicitações" },
    openDisputes: "Contestações abertas",
    heldAmount: "Valor retido",
    heldHint: "Fica bloqueado até a disputa ser resolvida",
    disputes: {
      title: "Contestações",
      description:
        "Abertas pelo cliente junto ao banco. A Kabrun retém o valor até a resolução — reunir provas de entrega ajuda a reverter.",
      evidenceDue: "Prazo para provas",
      emptyTitle: "Nenhuma contestação",
      emptyBody: "Nada foi contestado nas suas vendas até agora.",
    },
    list: {
      title: "Reembolsos",
      description: "Devoluções feitas por você. Para reembolsar, abra a venda e use o botão Reembolsar.",
      emptyTitle: "Nenhum reembolso",
      emptyBody: "Quando você devolver o valor de uma venda, ela aparece aqui.",
    },
  },

  analytics: {
    title: "Analytics",
    description: "Eventos de checkout dos últimos 30 dias, armazenados no MongoDB.",
    views: "Visitas ao checkout",
    completed: "Compras concluídas",
    conversion: "Conversão",
    emptyTitle: "Sem dados ainda",
    emptyBody: "Os eventos aparecem assim que visitarem seu checkout.",
    funnel: {
      title: "Funil de checkout",
      description: "Da visita até a compra.",
      viewed: "Checkout visto",
      customerCreated: "Dados preenchidos",
      paymentStarted: "Pagamento iniciado",
      completed: "Compra concluída",
    },
    sources: {
      title: "Principais origens",
      description: "utm_source das visitas ao checkout.",
      empty: "Sem origens registradas.",
    },
  },
};

export type AppDictionary = typeof pt;

export default pt;
