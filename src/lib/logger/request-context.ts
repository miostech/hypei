import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface RequestContext {
  requestId: string;
  correlationId: string;
  organizationId?: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function runWithRequestContext<T>(ctx: Partial<RequestContext>, fn: () => T): T {
  const requestId = ctx.requestId ?? randomUUID();
  return storage.run({ ...ctx, requestId, correlationId: ctx.correlationId ?? requestId }, fn);
}

/** Enriches the current context (e.g. once the organization is resolved). */
export function setRequestContext(patch: Partial<RequestContext>): void {
  const current = storage.getStore();
  if (current) Object.assign(current, patch);
}
