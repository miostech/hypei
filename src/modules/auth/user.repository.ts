import type { DbClient } from "@/lib/database/postgres/client";
import type { User, PlatformRole } from "@/generated/prisma/client";

export interface UpsertIdentityInput {
  keycloakUserId: string;
  email: string;
  name: string | null;
  locale?: string | null;
  platformRole: PlatformRole;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  upsertFromIdentity(input: UpsertIdentityInput): Promise<User>;
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: DbClient) {}

  findById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }

  upsertFromIdentity(input: UpsertIdentityInput) {
    return this.db.user.upsert({
      where: { keycloakUserId: input.keycloakUserId },
      create: {
        keycloakUserId: input.keycloakUserId,
        email: input.email.toLowerCase(),
        name: input.name,
        platformRole: input.platformRole,
        ...(input.locale ? { locale: input.locale } : {}),
      },
      update: { email: input.email.toLowerCase(), name: input.name, platformRole: input.platformRole },
    });
  }
}
