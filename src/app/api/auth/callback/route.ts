import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { exchangeCode, readRealmRoles, verifyIdToken } from "@/modules/auth/keycloak";
import {
  cookieOptions,
  OIDC_FLOW_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signToken,
  verifyToken,
  type OidcFlowClaims,
} from "@/modules/auth/session-token";
import { getServices } from "@/server/container";

/** OIDC callback: validates state/nonce/PKCE, verifies the ID token, links the Ripay User. */
export async function GET(request: NextRequest) {
  const env = getEnv();
  const params = request.nextUrl.searchParams;
  const flow = await verifyToken<OidcFlowClaims>(request.cookies.get(OIDC_FLOW_COOKIE)?.value, env.SESSION_SECRET);
  const fail = (reason: string) => {
    logger.warn({ reason }, "login callback rejected");
    const res = NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(reason)}`, env.APP_URL));
    res.cookies.delete(OIDC_FLOW_COOKIE);
    return res;
  };

  if (params.get("error")) return fail(params.get("error") ?? "error");
  const code = params.get("code");
  if (!flow || !code || params.get("state") !== flow.state) return fail("invalid_state");

  try {
    const tokens = await exchangeCode(code, flow.verifier);
    const identity = await verifyIdToken(tokens.id_token, flow.nonce);
    const roles = await readRealmRoles(tokens.access_token);

    const user = await getServices().uow.repos.users.upsertFromIdentity({
      keycloakUserId: identity.sub,
      email: identity.email,
      name: identity.name,
      locale: identity.locale,
      platformRole: roles.includes("platform_admin") ? "PLATFORM_ADMIN" : "USER",
    });

    const response = NextResponse.redirect(new URL(flow.returnTo, env.APP_URL));
    const session = await signToken({ uid: user.id, sub: identity.sub, idt: tokens.id_token }, env.SESSION_SECRET, SESSION_TTL_SECONDS);
    response.cookies.set(SESSION_COOKIE, session, cookieOptions(SESSION_TTL_SECONDS));
    response.cookies.delete(OIDC_FLOW_COOKIE);
    return response;
  } catch (err) {
    logger.error({ err }, "login callback failed");
    return fail("login_failed");
  }
}
