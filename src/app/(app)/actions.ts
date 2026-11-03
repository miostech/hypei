"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { isLocale, LANG_COOKIE, type Locale } from "@/lib/i18n/locale";
import { requireUser } from "@/modules/auth/current-user";
import { cookieOptions, ORGANIZATION_COOKIE } from "@/modules/auth/session-token";
import { getServices } from "@/server/container";

/** Switches the active tenant. Membership is verified before the cookie is written. */
export async function switchOrganization(organizationId: string): Promise<void> {
  const user = await requireUser();
  const membership = await getServices().uow.repos.organizations.findMembership(organizationId, user.id);
  if (!membership) throw new ForbiddenError("Você não faz parte desta organização");
  const store = await cookies();
  store.set(ORGANIZATION_COOKIE, organizationId, cookieOptions(60 * 60 * 24 * 30));
  revalidatePath("/", "layout");
}

/**
 * Guarda o idioma do app na conta do produtor.
 *
 * Vai para o banco, e não para cookie, porque é preferência de quem entrou e não do navegador:
 * trocar de máquina mantém a escolha. O cookie de idioma, se existir, é apagado — ele vem de um
 * `?lang=` que alguém usou num checkout, tem precedência sobre a conta, e sobreviver aqui faria
 * o seletor parecer quebrado.
 */
export async function setLanguage(locale: Locale): Promise<void> {
  if (!isLocale(locale)) throw new ValidationError("Idioma não suportado", { field: "locale" });
  const user = await requireUser();
  await getServices().uow.repos.users.updateLocale(user.id, locale);
  (await cookies()).delete(LANG_COOKIE);
  revalidatePath("/", "layout");
}
