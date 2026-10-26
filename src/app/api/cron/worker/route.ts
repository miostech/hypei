import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getServices } from "@/server/container";
import { runWorkerTick } from "@/workers/tick";

/**
 * O worker na Vercel. Não há processo longo em serverless, então o cron invoca esta rota
 * e ela roda uma passada — liberar settlement, publicar o outbox e repetir webhooks que
 * falharam. O agendamento está em `vercel.json`.
 *
 * Esta rota move dinheiro: sem ela, o saldo do produtor nunca sai de pendente. Por isso
 * ela falha fechada — sem `CRON_SECRET` configurado, recusa tudo em vez de ficar aberta.
 */
export const dynamic = "force-dynamic";

/** O teto do plano Hobby. O trabalho é limitado por lote, então uma passada cabe folgado. */
export const maxDuration = 60;

function authorized(request: NextRequest, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  // Comprimentos diferentes já não batem, e timingSafeEqual exige buffers iguais.
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export async function GET(request: NextRequest) {
  const secret = getEnv().CRON_SECRET;
  if (!secret) {
    logger.error({}, "cron worker called without CRON_SECRET configured");
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  }
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runWorkerTick(getServices());
    return NextResponse.json({ status: "ok", ...result }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    // Devolver 500 faz o cron da Vercel registrar a falha em vez de mascará-la.
    logger.error({ err }, "cron worker tick failed");
    return NextResponse.json({ error: "tick_failed" }, { status: 500 });
  }
}
