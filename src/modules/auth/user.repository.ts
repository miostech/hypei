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
  updateLocale(id: string, locale: string): Promise<void>;
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
      // `locale` fica fora do update de propósito: o Keycloak semeia o idioma no primeiro
      // login, e dali em diante quem manda é o seletor do app. Refrescar daqui desfaria a
      // escolha do produtor a cada login.
      update: { email: input.email.toLowerCase(), name: input.name, platformRole: input.platformRole },
    });
  }

  async updateLocale(id: string, locale: string) {
    await this.db.user.update({ where: { id }, data: { locale } });
  }
}
