import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";

export type { Prisma };

/** Either the root client or an interactive-transaction client. Only repositories use it. */
export type DbClient = PrismaClient | Prisma.TransactionClient;

export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { __hypeiPrisma?: PrismaClient };

/** Process-wide singleton (survives Next.js dev hot reloads). */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__hypeiPrisma) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured");
    globalForPrisma.__hypeiPrisma = createPrismaClient(url);
  }
  return globalForPrisma.__hypeiPrisma;
}

/** Postgres unique-constraint violation (P2002) detection, used for idempotent inserts. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}
