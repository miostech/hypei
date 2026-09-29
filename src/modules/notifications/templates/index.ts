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

export function purchaseConfirmed(data: Party & {
  customerName: string;
  productName: string;
  amountLabel: string;
  orderReference: string;
  /** Present when the product has a published course. */
  accessUrl?: string;
}): RenderedEmail {
  const firstName = data.customerName.split(" ")[0] || "Olá";
  return renderEmail(`Compra confirmada: ${data.productName}`, {
    preheader: `Seu pagamento de ${data.amountLabel} foi confirmado.`,
    heading: "Pagamento confirmado",
    intro: data.accessUrl
      ? `${firstName}, recebemos seu pagamento e seu acesso já está liberado.`
      : `${firstName}, recebemos seu pagamento. ${data.organizationName} vai entrar em contato com os próximos passos.`,
    rows: [
      { label: "Produto", value: data.productName },
      { label: "Valor", value: data.amountLabel },
      { label: "Pedido", value: data.orderReference },
    ],
    cta: data.accessUrl ? { label: "Acessar o conteúdo", url: data.accessUrl } : undefined,
    note: data.accessUrl ? "Use o mesmo e-mail desta compra para entrar." : undefined,
    organizationName: data.organizationName,
    supportEmail: data.supportEmail,
    audience: "buyer",
  });
}

export function saleCompleted(data: Party & {
  productName: string;
  amountLabel: string;
  netLabel: string;
  customerName: string;
  customerEmail: string;
  dashboardUrl: string;
}): RenderedEmail {
  return renderEmail(`Nova venda: ${data.productName}`, {
    preheader: `${data.amountLabel} — ${data.customerName}`,
    heading: "Você fez uma venda",
    intro: `${data.customerName} comprou ${data.productName}.`,
    rows: [
      { label: "Valor da venda", value: data.amountLabel },
      { label: "Você recebe", value: data.netLabel },
      { label: "Cliente", value: data.customerEmail },
    ],
    cta: { label: "Ver no painel", url: data.dashboardUrl },
    note: "O valor entra como pendente e fica disponível para saque quando o prazo de liberação vencer.",
    organizationName: data.organizationName,
    audience: "producer",
  });
}

export function refundCompleted(data: Party & {
  customerName: string;
  productName: string;
  amountLabel: string;
}): RenderedEmail {
  const firstName = data.customerName.split(" ")[0] || "Olá";
  return renderEmail(`Reembolso de ${data.amountLabel}`, {
    preheader: `Seu reembolso de ${data.amountLabel} foi processado.`,
    heading: "Reembolso processado",
    intro: `${firstName}, o reembolso da sua compra foi processado.`,
    rows: [
      { label: "Produto", value: data.productName },
      { label: "Valor devolvido", value: data.amountLabel },
    ],
    note: "O prazo para o valor aparecer na fatura depende do banco ou da bandeira do cartão, normalmente até duas faturas.",
    organizationName: data.organizationName,
    supportEmail: data.supportEmail,
    audience: "buyer",
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
    organizationName: data.organizationName,
    audience: "producer",
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
    organizationName: data.organizationName,
    audience: "producer",
  });
}
