import { logger } from "@/lib/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: Record<string, string>;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ id: string }>;
}

/** Development provider: logs a summary (never the body, which may contain personal data). */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  async send(message: EmailMessage) {
    logger.info({ to: message.to, subject: message.subject }, "email (console provider)");
    return { id: `console_${Date.now()}` };
  }
}

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: message.to, subject: message.subject, html: message.html, text: message.text }),
    });
    if (!response.ok) throw new Error(`Resend responded ${response.status}`);
    return (await response.json()) as { id: string };
  }
}

export function createEmailProvider(env: { EMAIL_PROVIDER: string; EMAIL_FROM: string; RESEND_API_KEY?: string }): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case "resend":
      if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is required for EMAIL_PROVIDER=resend");
      return new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM);
    case "ses":
    case "postmark":
      throw new Error(`Email provider "${env.EMAIL_PROVIDER}" adapter is planned for a later phase`);
    default:
      return new ConsoleEmailProvider();
  }
}
