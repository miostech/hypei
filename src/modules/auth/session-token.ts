import { jwtVerify, SignJWT, type JWTPayload } from "jose";

/**
 * Session cookie format (signed HS256 JWT, httpOnly). Kept free of `server-only` / env
 * imports so the proxy can use it for optimistic checks.
 */
export const SESSION_COOKIE = "hypei_session";
export const OIDC_FLOW_COOKIE = "hypei_oidc";
export const ORGANIZATION_COOKIE = "hypei_org";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

export interface SessionClaims {
  uid: string;
  sub: string;
  /** id_token hint for RP-initiated logout at Keycloak. */
  idt?: string;
}

export interface OidcFlowClaims {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
}

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signToken<T extends object>(claims: T, secret: string, ttlSeconds: number): Promise<string> {
  return new SignJWT({ ...claims } as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("hypei")
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key(secret));
}

export async function verifyToken<T>(token: string | undefined, secret: string): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: "hypei", algorithms: ["HS256"] });
    return payload as T;
  } catch {
    return null;
  }
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Only allow same-origin relative redirects (prevents open redirects). */
export function safeReturnTo(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
