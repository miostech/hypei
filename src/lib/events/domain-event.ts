import { randomUUID } from "node:crypto";

export const DOMAIN_EVENT_TYPES = [
  "organization.created",
  "order.created",
  "payment.created",
  "payment.paid",
  "payment.failed",
  "refund.created",
  "refund.completed",
  "subscription.created",
  "subscription.renewed",
  "subscription.canceled",
  "balance.updated",
  "settlement.released",
  "payout.requested",
  "payout.paid",
  "payout.failed",
  "dispute.created",
  "dispute.closed",
  "merchant_account.updated",
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

export interface DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  type: DomainEventType;
  aggregateId: string;
  organizationId: string | null;
  occurredAt: Date;
  payload: TPayload;
}

export function createDomainEvent<TPayload extends Record<string, unknown>>(
  type: DomainEventType,
  aggregateId: string,
  organizationId: string | null,
  payload: TPayload,
): DomainEvent<TPayload> {
  return { id: randomUUID(), type, aggregateId, organizationId, occurredAt: new Date(), payload: { ...payload, organizationId } };
}
