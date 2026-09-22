import type { EnqueueOptions, JobHandler, JobQueue } from "@/lib/providers/queue/job-queue";

/** Deterministic queue for tests: jobs run only when `drain()` is called. */
export class ManualQueue implements JobQueue {
  private readonly handlers = new Map<string, JobHandler<unknown>>();
  readonly jobs: { name: string; payload: unknown; jobId?: string }[] = [];

  process<T>(name: string, handler: JobHandler<T>) {
    this.handlers.set(name, handler as JobHandler<unknown>);
  }

  async enqueue<T>(name: string, payload: T, options: EnqueueOptions = {}) {
    if (options.jobId && this.jobs.some((j) => j.name === name && j.jobId === options.jobId)) return;
    this.jobs.push({ name, payload, jobId: options.jobId });
  }

  async drain() {
    while (this.jobs.length > 0) {
      const job = this.jobs.shift()!;
      await this.handlers.get(job.name)?.(job.payload);
    }
  }
}
