import { handleWebhookRequest } from "@/modules/webhooks/webhook-http";

/** Stripe webhooks (platform + Connect). Signature validated with STRIPE_WEBHOOK_SECRET. */
export async function POST(request: Request) {
  return handleWebhookRequest("STRIPE", request);
}
