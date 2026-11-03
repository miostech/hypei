import { fill } from "@/lib/i18n/locale";
import type { EmailDictionary } from "@/lib/i18n/email";
import { renderEmail, type RenderedEmail } from "./layout";

export type { RenderedEmail } from "./layout";

/** Every template the platform can send; the name is also the idempotency key. */
export const EMAIL_TEMPLATES = [
  "purchase.confirmed",
  "sale.completed",
  "refund.completed",
  "payout.paid",
  "dispute.opened",
] as const;

export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

interface Party {
  organizationName: string;
  supportEmail?: string;
}

/** Quem vende, como falar com ele, quem processou — no idioma de quem vai ler. */
function buyerFooter(dict: EmailDictionary, party: Party): string[] {
  return [
    fill(dict.footer.soldBy, { seller: party.organizationName }),
    ...(party.supportEmail ? [fill(dict.footer.support, { email: party.supportEmail })] : []),
    dict.footer.processedBy,
  ];
}

/**
 * O produtor é quem vende na Kabrun, e é brasileiro: o rodapé dele e os três e-mails abaixo
 * seguem em pt-BR, igual ao painel que ele usa todo dia.
 */
function producerFooter(party: Party): string[] {
  return [`Enviado pela Kabrun para ${party.organizationName}.`];
}

const PRODUCER_LANG = "pt-BR";

/** O primeiro nome, ou o vocativo do dicionário quando não dá para extrair um. */
function firstName(dict: EmailDictionary, customerName: string): string {
  return customerName.trim().split(" ")[0] || dict.greeting;
}

export function purchaseConfirmed(
  dict: EmailDictionary,
  data: Party & {
    customerName: string;
    /** Null quando o pedido não tem item identificável. */
    productName: string | null;
    amountLabel: string;
    orderReference: string;
    /** Present when the product has a published course. */
    accessUrl?: string;
  },
): RenderedEmail {
  const name = firstName(dict, data.customerName);
  const product = data.productName ?? dict.fallbackPurchaseProduct;
  const t = dict.purchaseConfirmed;

  return renderEmail(fill(t.subject, { product }), {
    preheader: fill(t.preheader, { amount: data.amountLabel }),
    heading: t.heading,
    intro: data.accessUrl
      ? fill(t.introWithAccess, { name })
      : fill(t.introWithoutAccess, { name, seller: data.organizationName }),
    rows: [
      { label: t.rowProduct, value: product },
      { label: t.rowAmount, value: data.amountLabel },
      { label: t.rowOrder, value: data.orderReference },
    ],
    cta: data.accessUrl ? { label: t.cta, url: data.accessUrl } : undefined,
    note: data.accessUrl ? t.note : undefined,
    lang: dict.localeTag,
    footer: buyerFooter(dict, data),
  });
}

export function refundCompleted(
  dict: EmailDictionary,
  data: Party & {
    customerName: string;
    productName: string | null;
    amountLabel: string;
  },
): RenderedEmail {
  const name = firstName(dict, data.customerName);
  const product = data.productName ?? dict.fallbackRefundProduct;
  const t = dict.refundCompleted;

  return renderEmail(fill(t.subject, { amount: data.amountLabel }), {
    preheader: fill(t.preheader, { amount: data.amountLabel }),
    heading: t.heading,
    intro: fill(t.intro, { name }),
    rows: [
      { label: t.rowProduct, value: product },
      { label: t.rowAmount, value: data.amountLabel },
    ],
    note: t.note,
    lang: dict.localeTag,
    footer: buyerFooter(dict, data),
  });
}

export function saleCompleted(data: Party & {
  productName: string | null;
  amountLabel: string;
  netLabel: string;
  customerName: string;
  customerEmail: string;
  dashboardUrl: string;
}): RenderedEmail {
  const product = data.productName ?? "seu produto";
  return renderEmail(`Nova venda: ${product}`, {
    preheader: `${data.amountLabel} — ${data.customerName}`,
    heading: "Você fez uma venda",
    intro: `${data.customerName} comprou ${product}.`,
    rows: [
      { label: "Valor da venda", value: data.amountLabel },
      { label: "Você recebe", value: data.netLabel },
      { label: "Cliente", value: data.customerEmail },
    ],
    cta: { label: "Ver no painel", url: data.dashboardUrl },
    note: "O valor entra como pendente e fica disponível para saque quando o prazo de liberação vencer.",
    lang: PRODUCER_LANG,
    footer: producerFooter(data),
  });
}

export function payoutPaid(data: Party & { amountLabel: string; destinationLabel: string; financeUrl: string }): RenderedEmail {
  return renderEmail(`Saque de ${data.amountLabel} enviado`, {
    preheader: `Seu saque de ${data.amountLabel} foi enviado.`,
    heading: "Saque enviado",
    intro: "O valor saiu do seu saldo e foi enviado para sua conta.",
    rows: [
      { label: "Valor", value: data.amountLabel },
      { label: "Destino", value: data.destinationLabel },
    ],
    cta: { label: "Ver financeiro", url: data.financeUrl },
    lang: PRODUCER_LANG,
    footer: producerFooter(data),
  });
}

export function disputeOpened(data: Party & { amountLabel: string; productName: string; dashboardUrl: string }): RenderedEmail {
  return renderEmail(`Contestação aberta: ${data.amountLabel}`, {
    preheader: "Um cliente contestou uma cobrança. Há prazo para responder.",
    heading: "Contestação aberta",
    intro: `Um cliente contestou a cobrança de ${data.productName}. O valor fica retido até a disputa ser resolvida.`,
    rows: [
      { label: "Valor contestado", value: data.amountLabel },
      { label: "Produto", value: data.productName },
    ],
    cta: { label: "Ver detalhes", url: data.dashboardUrl },
    note: "Responder com provas de entrega e do aceite dos termos aumenta muito a chance de reverter a contestação.",
    lang: PRODUCER_LANG,
    footer: producerFooter(data),
  });
}
