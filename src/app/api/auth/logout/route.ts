import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { buildLogoutUrl } from "@/modules/auth/keycloak";
import { ORGANIZATION_COOKIE, SESSION_COOKIE, verifyToken, type SessionClaims } from "@/modules/auth/session-token";

/** Clears the Ripay session and ends the Keycloak SSO session (RP-initiated logout). POST only (CSRF-safe). */
export async function POST(request: NextRequest) {
  const env = getEnv();
  const session = await verifyToken<SessionClaims>(request.cookies.get(SESSION_COOKIE)?.value, env.SESSION_SECRET);
  const response = NextResponse.redirect(buildLogoutUrl(session?.idt ?? null), { status: 303 });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(ORGANIZATION_COOKIE);
  return response;
}
