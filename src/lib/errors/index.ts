/**
 * Domain error hierarchy. Every error carries a stable machine code so it can be
 * mapped to HTTP responses / UI messages without string matching.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, details);
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id?: string) {
    super("NOT_FOUND", `${entity} not found`, id ? { entity, id } : { entity });
  }
}

export class UnauthenticatedError extends DomainError {
  constructor() {
    super("UNAUTHENTICATED", "Authentication required");
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "You do not have permission to perform this action") {
    super("FORBIDDEN", message);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("CONFLICT", message, details);
  }
}

export class MoneyError extends DomainError {
  constructor(message: string) {
    super("MONEY_ERROR", message);
  }
}

export class CurrencyMismatchError extends DomainError {
  constructor(a: string, b: string) {
    super("CURRENCY_MISMATCH", `Cannot operate on different currencies without explicit conversion (${a} vs ${b})`);
  }
}

export class UnbalancedJournalError extends DomainError {
  constructor(debits: bigint, credits: bigint) {
    super("LEDGER_UNBALANCED", `Ledger journal is unbalanced: debits=${debits} credits=${credits}`);
  }
}

export class InsufficientFundsError extends DomainError {
  constructor(message = "Insufficient available balance") {
    super("INSUFFICIENT_FUNDS", message);
  }
}

export class PayoutNotAllowedError extends DomainError {
  constructor(message: string) {
    super("PAYOUT_NOT_ALLOWED", message);
  }
}

export class RefundNotAllowedError extends DomainError {
  constructor(message: string) {
    super("REFUND_NOT_ALLOWED", message);
  }
}

export class WebhookSignatureError extends DomainError {
  constructor(provider: string) {
    super("WEBHOOK_SIGNATURE_INVALID", `Invalid webhook signature for provider ${provider}`);
  }
}

export class ProviderError extends DomainError {
  constructor(provider: string, message: string, details?: Record<string, unknown>) {
    super("PROVIDER_ERROR", `[${provider}] ${message}`, details);
  }
}

export class IdempotencyConflictError extends DomainError {
  constructor(key: string) {
    super("IDEMPOTENCY_CONFLICT", `Idempotency key "${key}" was already used with a different request`);
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
