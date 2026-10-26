import { logger } from "@/lib/logger";
import type { Services } from "@/server/services";

export interface TickResult {
  retried: number;
  published: number;
  settled: number;
  released: string;
}

/**
 * Uma passada do worker. É o mesmo trabalho em qualquer hospedagem: processo longo
 * (`npm run worker`) ou invocação de cron na Vercel.
 *
 * As três rotinas são seguras para rodar concorrentemente, o que é o que permite
 * chamá-las de um cron sem coordenação: o outbox reclama linhas com
 * `FOR UPDATE SKIP LOCKED`, o settlement trava o pagamento e ignora o que já liberou,
 * e o processamento de webhook é idempotente por evento.
 */
export async function runWorkerTick(services: Services): Promise<TickResult> {
  const [retried, published, settlement] = await Promise.all([
    services.webhookProcessor.retryDue(),
    services.outboxPublisher.publishPending(),
    services.settlements.releaseDue(),
  ]);

  const result: TickResult = {
    retried,
    published,
    settled: settlement.processed,
    released: settlement.released.toString(),
  };

  if (retried || published || settlement.processed) logger.info(result, "worker tick");
  return result;
}
