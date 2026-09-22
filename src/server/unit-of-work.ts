import type { PrismaClient } from "@/generated/prisma/client";
import { createRepositories, type Repositories } from "./repositories";

/**
 * Services never see PrismaClient. They receive repositories, and use `transaction`
 * whenever several writes must commit atomically (e.g. Payment PAID + Order PAID +
 * Transaction + LedgerEntries + Balance projection + OutboxEvent).
 */
export interface UnitOfWork {
  readonly repos: Repositories;
  transaction<T>(fn: (repos: Repositories) => Promise<T>): Promise<T>;
}

export class PrismaUnitOfWork implements UnitOfWork {
  readonly repos: Repositories;

  constructor(private readonly prisma: PrismaClient) {
    this.repos = createRepositories(prisma);
  }

  transaction<T>(fn: (repos: Repositories) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => fn(createRepositories(tx)), {
      isolationLevel: "ReadCommitted",
      maxWait: 5_000,
      timeout: 15_000,
    });
  }
}
