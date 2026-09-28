import "dotenv/config";
import { logger } from "@/lib/logger";
import { getServices } from "@/server/container";

/**
 * Background worker loop (Phase 1: a single process; BullMQ/Redis Streams later).
 * Responsibilities:
 *  - retry webhook events that failed or were never processed,
 *  - publish transactional outbox events,
 *  - release settlements whose window has elapsed.
 */
const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 15_000);

async function tick() {
  const services = getServices();
  const [retried, published, settlement] = await Promise.all([
    services.webhookProcessor.retryDue(),
    services.outboxPublisher.publishPending(),
    services.settlements.releaseDue(),
  ]);
  if (retried || published || settlement.processed) {
    logger.info({ retried, published, settled: settlement.processed, released: settlement.released.toString() }, "worker tick");
  }
}

async function main() {
  logger.info({ intervalMs: INTERVAL_MS }, "ripay worker started");
  for (;;) {
    await tick().catch((err) => logger.error({ err }, "worker tick failed"));
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

void main();
