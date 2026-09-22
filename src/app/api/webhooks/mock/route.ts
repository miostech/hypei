import { NextResponse } from "next/server";
import { handleWebhookRequest } from "@/modules/webhooks/webhook-http";

/** MockPaymentProvider webhooks (HMAC-signed with MOCK_WEBHOOK_SECRET). Disabled in production. */
export async function POST(request: Request) {
  if (process.env.APP_ENV === "production") return NextResponse.json({ error: "not_found" }, { status: 404 });
  return handleWebhookRequest("MOCK", request);
}
