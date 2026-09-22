import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { buildAuthorizationUrl, createPkcePair, randomToken } from "@/modules/auth/keycloak";
import { cookieOptions, OIDC_FLOW_COOKIE, safeReturnTo, signToken, type OidcFlowClaims } from "@/modules/auth/session-token";

/** Starts the OIDC Authorization Code + PKCE flow against Keycloak. */
export async function GET(request: NextRequest) {
  const env = getEnv();
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const signup = request.nextUrl.searchParams.get("signup") === "1";
  const { verifier, challenge } = createPkcePair();
  const flow: OidcFlowClaims = { state: randomToken(), nonce: randomToken(), verifier, returnTo };

  const response = NextResponse.redirect(
    buildAuthorizationUrl({ state: flow.state, nonce: flow.nonce, codeChallenge: challenge, prompt: signup ? "create" : undefined }),
  );
  response.cookies.set(OIDC_FLOW_COOKIE, await signToken(flow, env.SESSION_SECRET, 600), cookieOptions(600));
  return response;
}
