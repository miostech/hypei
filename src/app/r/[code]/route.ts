import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { REFERRAL_COOKIE, REFERRAL_MAX_AGE_SECONDS, normalizeReferralCode } from "@/modules/affiliates/referral";
import { getServices } from "@/server/container";

/**
 * O link que o afiliado divulga. Guarda a indicação e manda a pessoa para o checkout do produto.
 *
 * A indicação é gravada aqui, no servidor, e não na página de pagamento: antes o cookie só
 * nascia se a pessoa caísse direto no checkout com `?ref=`, então qualquer link que passasse
 * por outra página perdia a atribuição e o afiliado trabalhava de graça.
 *
 * Código inválido ou produto sem checkout ativo levam para a home, sem erro na cara de quem
 * clicou: a pessoa não tem nada a ver com um link que o produtor desativou.
 */
export async function GET(_request: NextRequest, { params }: RouteContext<"/r/[code]">) {
  const { code } = await params;
  const referral = normalizeReferralCode(code);
  const appUrl = getEnv().APP_URL;

  const link = await getServices().affiliates.resolveLink(referral);
  if (!link) return NextResponse.redirect(new URL("/", appUrl));

  // O `ref` na URL fica junto do cookie de propósito: é o cookie que atravessa os 30 dias,
  // e é a URL que faz a venda ser atribuída mesmo se o navegador bloquear o cookie.
  const destination = new URL(`/checkout/${link.slug}`, appUrl);
  destination.searchParams.set("ref", referral);

  const response = NextResponse.redirect(destination);
  response.cookies.set(REFERRAL_COOKIE, referral, {
    path: "/",
    maxAge: REFERRAL_MAX_AGE_SECONDS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  // O clique é contado depois do destino estar resolvido, e uma falha aqui não derruba o
  // redirecionamento: contador é estatística, e perder uma estatística não pode custar a venda.
  await getServices()
    .affiliates.registerClick(referral)
    .catch((err) => logger.warn({ err, referral }, "affiliate click tracking failed"));
  return response;
}
