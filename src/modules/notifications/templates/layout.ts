export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface EmailBlock {
  preheader: string;
  heading: string;
  intro: string;
  rows?: { label: string; value: string }[];
  cta?: { label: string; url: string };
  note?: string;
  /** Shown in the footer: the producer sells, Ripay only processes. */
  organizationName: string;
  supportEmail?: string;
  /** Buyers are told who sold to them; producers are told who is writing. */
  audience: "buyer" | "producer";
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * E-mail clients only reliably support inline styles and simple markup, so the layout
 * stays deliberately plain: one column, no external CSS, no web fonts.
 */
export function renderEmail(subject: string, block: EmailBlock): RenderedEmail {
  const rows = (block.rows ?? [])
    .map(
      ({ label, value }) => `
        <tr>
          <td style="padding:8px 0;color:#6b6b7b;font-size:14px;">${escapeHtml(label)}</td>
          <td style="padding:8px 0;color:#16161d;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const cta = block.cta
    ? `<tr><td style="padding:28px 0 4px;">
         <a href="${encodeURI(block.cta.url)}" style="display:inline-block;background:#5B3DF5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 26px;border-radius:12px;">${escapeHtml(block.cta.label)}</a>
       </td></tr>`
    : "";

  const note = block.note
    ? `<tr><td style="padding:20px 0 0;color:#6b6b7b;font-size:13px;line-height:20px;">${escapeHtml(block.note)}</td></tr>`
    : "";

  const footer =
    block.audience === "buyer"
      ? `Esta compra foi feita com ${escapeHtml(block.organizationName)}.${
          block.supportEmail ? ` Dúvidas? Responda este e-mail ou escreva para ${escapeHtml(block.supportEmail)}.` : ""
        }<br />Pagamento processado pela Ripay.`
      : `Enviado pela Ripay para ${escapeHtml(block.organizationName)}.`;

  const html = `<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(subject)}</title></head>
  <body style="margin:0;padding:0;background:#f4f4f7;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(block.preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <tr><td style="background:linear-gradient(135deg,#5B3DF5,#7A5CFA);padding:22px 32px;">
            <span style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:-0.3px;">Ripay</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 10px;color:#16161d;font-size:21px;line-height:28px;font-weight:700;">${escapeHtml(block.heading)}</h1>
            <p style="margin:0;color:#43434f;font-size:15px;line-height:23px;">${escapeHtml(block.intro)}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border-top:1px solid #ececf1;">
              ${rows}
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0">${cta}${note}</table>
          </td></tr>
          <tr><td style="padding:20px 32px 28px;border-top:1px solid #ececf1;color:#8a8a99;font-size:12px;line-height:19px;">
            ${footer}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    block.heading,
    "",
    block.intro,
    "",
    ...(block.rows ?? []).map(({ label, value }) => `${label}: ${value}`),
    ...(block.cta ? ["", `${block.cta.label}: ${block.cta.url}`] : []),
    ...(block.note ? ["", block.note] : []),
    "",
    block.audience === "buyer"
      ? `Esta compra foi feita com ${block.organizationName}.${block.supportEmail ? ` Contato: ${block.supportEmail}.` : ""}\nPagamento processado pela Ripay.`
      : `Enviado pela Ripay para ${block.organizationName}.`,
  ].join("\n");

  return { subject, html, text };
}
