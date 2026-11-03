import "server-only";
import { cookies, headers } from "next/headers";
import { getCurrentUser } from "@/modules/auth/current-user";
import { isLocale, LANG_COOKIE, resolveLocale, type Locale } from "../locale";
import { getAppDictionary, type AppDictionary } from ".";

/**
 * Idioma do produtor.
 *
 * A ordem é outra que no checkout, porque aqui existe conta: `User.locale` é preferência que a
 * pessoa registrou, e preferência registrada ganha do palpite do navegador. O ?lang= continua
 * acima de tudo para conferir uma tela sem mudar a conta.
 *
 * `getCurrentUser` é `cache()`, então ler o usuário aqui não cobra consulta nova — a página já
 * o buscou para saber quem está logado.
 */
export async function appLocale(override?: string | null): Promise<Locale> {
  if (isLocale(override)) return override;

  const stored = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLocale(stored)) return stored;

  const user = await getCurrentUser();
  const preferred = user?.locale?.toLowerCase().split("-")[0];
  if (isLocale(preferred)) return preferred;

  return resolveLocale((await headers()).get("accept-language"));
}

export async function appDictionary(override?: string | null): Promise<AppDictionary> {
  return getAppDictionary(await appLocale(override));
}
