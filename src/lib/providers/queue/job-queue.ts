import { logger } from "@/lib/logger";

export type JobHandler<T> = (payload: T) => Promise<void>;

export interface EnqueueOptions {
  /** Deduplicates jobs with the same id while pending. */
  jobId?: string;
  delayMs?: number;
  attempts?: number;
}

/**
 * Queue abstraction. Phase 1 uses an in-process implementation; BullMQ or Redis Streams
 * implementations plug in behind the same interface (see ADR 007).
 */
export interface JobQueue {
  enqueue<T>(name: string, payload: T, options?: EnqueueOptions): Promise<void>;
  process<T>(name: string, handler: JobHandler<T>): void;
}

export class InMemoryJobQueue implements JobQueue {
  private readonly handlers = new Map<string, JobHandler<unknown>>();
  private readonly pending = new Set<string>();

  process<T>(name: string, handler: JobHandler<T>): void {
    this.handlers.set(name, handler as JobHandler<unknown>);
  }

  async enqueue<T>(name: string, payload: T, options: EnqueueOptions = {}): Promise<void> {
    const key = options.jobId ? `${name}:${options.jobId}` : undefined;
    if (key && this.pending.has(key)) return;
    if (key) this.pending.add(key);
    const attempts = options.attempts ?? 5;

    const run = async (attempt: number) => {
      const handler = this.handlers.get(name);
      if (!handler) {
        logger.warn({ job: name }, "no handler registered for job");
        if (key) this.pending.delete(key);
        return;
      }
      try {
        await handler(payload);
        if (key) this.pending.delete(key);
      } catch (err) {
        if (attempt >= attempts) {
          logger.error({ err, job: name, attempt }, "job failed permanently");
          if (key) this.pending.delete(key);
          return;
        }
        const backoff = Math.min(30_000, 2 ** attempt * 250);
        logger.warn({ err, job: name, attempt, backoff }, "job failed; retrying");
        setTimeout(() => void run(attempt + 1), backoff);
      }
    };
    setTimeout(() => void run(1), options.delayMs ?? 0);
  }
}

/** Placeholder so the driver can be selected by config; implemented in a later phase. */
export class UnsupportedQueueDriver implements JobQueue {
  constructor(private readonly driver: string) {}
  enqueue(): Promise<void> {
    throw new Error(`Queue driver "${this.driver}" is not available in Phase 1 (use QUEUE_DRIVER=memory)`);
  }
  process(): void {
    throw new Error(`Queue driver "${this.driver}" is not available in Phase 1 (use QUEUE_DRIVER=memory)`);
  }
}
