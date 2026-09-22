import type { DbClient } from "@/lib/database/postgres/client";

export interface AuditEntry {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditRepository {
  record(entry: AuditEntry): Promise<void>;
}

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly db: DbClient) {}

  async record(entry: AuditEntry) {
    await this.db.auditLog.create({
      data: {
        ...entry,
        metadata: entry.metadata
          ? JSON.parse(JSON.stringify(entry.metadata, (_k, v) => (typeof v === "bigint" ? v.toString() : v)))
          : undefined,
      },
    });
  }
}
