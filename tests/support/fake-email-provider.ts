import type { EmailMessage, EmailProvider } from "@/lib/providers/email/email-provider";

/** Captures messages instead of sending them, and can be told to fail on demand. */
export class FakeEmailProvider implements EmailProvider {
  readonly name = "fake";
  readonly sent: EmailMessage[] = [];
  /** When set, `send` throws — used to exercise the retry path. */
  failNext = false;

  async send(message: EmailMessage) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("provider unavailable");
    }
    this.sent.push(message);
    return { id: `fake_${this.sent.length}` };
  }

  /** Messages addressed to someone, newest last. */
  to(recipient: string): EmailMessage[] {
    return this.sent.filter((message) => message.to === recipient);
  }

  withTemplate(template: string): EmailMessage[] {
    return this.sent.filter((message) => message.tags?.template === template);
  }

  clear(): void {
    this.sent.length = 0;
  }
}
