import "dotenv/config";
import { logger } from "@/lib/logger";
import { getServices } from "@/server/container";
import { runWorkerTick } from "./tick";

/**
 * Worker como processo longo, para desenvolvimento e para hospedagem que o permita.
 * Na Vercel o mesmo trabalho entra por `GET /api/cron/worker`, invocado pelo cron —
 * os dois chamam `runWorkerTick`, que é onde a lógica mora.
 */
const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 15_000);

async function main() {
  logger.info({ intervalMs: INTERVAL_MS }, "kabrun worker started");
  for (;;) {
    await runWorkerTick(getServices()).catch((err) => logger.error({ err }, "worker tick failed"));
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

void main();
