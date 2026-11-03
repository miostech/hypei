import type { LocaleTag } from "../locale";

/**
 * Dicionário dos e-mails que vão para o comprador, em português. Fonte da forma, como os outros.
 *
 * Só os dois e-mails do comprador moram aqui. Os do produtor — venda, saque, contestação —
 * seguem em pt-BR dentro do próprio template: quem os lê é quem vende, e o painel dele também
 * é em português.
 *
 * O idioma não vem de requisição nenhuma: estes e-mails saem do outbox, depois do commit e
 * possivelmente horas depois. Vem do `Customer.locale`, gravado na hora da compra.
 */
const pt = {
  localeTag: "pt-BR" as LocaleTag,

  /** Vocativo quando o nome do comprador não dá um primeiro nome aproveitável. */
  greeting: "Olá",
  /** Pedido sem item identificável — não deveria acontecer, mas o e-mail não pode sair vazio. */
  fallbackPurchaseProduct: "seu pedido",
  fallbackRefundProduct: "sua compra",

  footer: {
    soldBy: "Esta compra foi feita com {seller}.",
    support: "Dúvidas? Responda este e-mail ou escreva para {email}.",
    processedBy: "Pagamento processado pela Kabrun.",
  },

  purchaseConfirmed: {
    subject: "Compra confirmada: {product}",
    preheader: "Seu pagamento de {amount} foi confirmado.",
    heading: "Pagamento confirmado",
    introWithAccess: "{name}, recebemos seu pagamento e seu acesso já está liberado.",
    introWithoutAccess: "{name}, recebemos seu pagamento. {seller} vai entrar em contato com os próximos passos.",
    rowProduct: "Produto",
    rowAmount: "Valor",
    rowOrder: "Pedido",
    rowAlsoBought: "Também na compra",
    noteExtras: "Os outros produtos ficam na sua área de membros, com o mesmo e-mail.",
    cta: "Acessar o conteúdo",
    note: "Use o mesmo e-mail desta compra para entrar.",
  },

  refundCompleted: {
    subject: "Reembolso de {amount}",
    preheader: "Seu reembolso de {amount} foi processado.",
    heading: "Reembolso processado",
    intro: "{name}, o reembolso da sua compra foi processado.",
    rowProduct: "Produto",
    rowAmount: "Valor devolvido",
    note: "O prazo para o valor aparecer na fatura depende do banco ou da bandeira do cartão, normalmente até duas faturas.",
  },
};

export type EmailDictionary = typeof pt;

export default pt;
