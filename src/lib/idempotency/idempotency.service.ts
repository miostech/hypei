import { createHash } from "node:crypto";
import { IdempotencyConflictError } from "@/lib/errors";
import type { IdempotencyRepository } from "./idempotency.repository";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export function hashRequest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)))
    .digest("hex");
}

/**
 * Request-level idempotency (e.g. "start checkout", "create refund").
 * Same key + same request ⇒ same stored response. Same key + different request ⇒ conflict.
 */
export class IdempotencyService {
  constructor(private readonly repo: IdempotencyRepository) {}

  async run<T>(scope: string, key: string, request: unknown, fn: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
    const fullKey = `${scope}:${key}`;
    const requestHash = hashRequest(request);

    const inserted = await this.repo.tryInsert({ key: fullKey, scope, requestHash, expiresAt: new Date(Date.now() + ttlMs) });
    if (!inserted) {
      const existing = await this.repo.find(fullKey);
      if (existing && existing.requestHash !== requestHash) throw new IdempotencyConflictError(fullKey);
      if (existing?.responseData != null) return existing.responseData as T;
      throw new IdempotencyConflictError(`${fullKey} (request still in progress)`);
    }

    try {
      const result = await fn();
      await this.repo.saveResponse(fullKey, result);
      return result;
    } catch (error) {
      // Allow the client to retry after a failure.
      await this.repo.delete(fullKey);
      throw error;
    }
  }
}
