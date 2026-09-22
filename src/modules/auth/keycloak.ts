import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { getEnv } from "@/lib/env";

/**
 * Keycloak (OIDC) is responsible for identity: login, logout, passwords, email verification,
 * recovery, sessions, MFA and social login. Hypei only consumes the verified identity.
 */
function urls() {
  const env = getEnv();
  const publicBase = `${env.KEYCLOAK_URL}/realms/${env.KEYCLOAK_REALM}`;
  const internalBase = `${env.KEYCLOAK_INTERNAL_URL ?? env.KEYCLOAK_URL}/realms/${env.KEYCLOAK_REALM}`;
  return {
    issuer: publicBase,
    authorize: `${publicBase}/protocol/openid-connect/auth`,
    endSession: `${publicBase}/protocol/openid-connect/logout`,
    token: `${internalBase}/protocol/openid-connect/token`,
    jwks: `${internalBase}/protocol/openid-connect/certs`,
    discovery: `${internalBase}/.well-known/openid-configuration`,
  };
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
function getJwks() {
  jwks ??= createRemoteJWKSet(new URL(urls().jwks));
  return jwks;
}

const base64url = (buf: Buffer) => buf.toString("base64url");

export function createPkcePair() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function randomToken(bytes = 24) {
  return base64url(randomBytes(bytes));
}

export function redirectUri() {
  return `${getEnv().APP_URL}/api/auth/callback`;
}

export function buildAuthorizationUrl(input: { state: string; nonce: string; codeChallenge: string; prompt?: "login" | "create" }) {
  const env = getEnv();
  const url = new URL(urls().authorize);
  url.searchParams.set("client_id", env.KEYCLOAK_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (input.prompt === "create") url.searchParams.set("prompt", "create");
  return url.toString();
}

export interface KeycloakTokens {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export async function exchangeCode(code: string, codeVerifier: string): Promise<KeycloakTokens> {
  const env = getEnv();
  const response = await fetch(urls().token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      client_id: env.KEYCLOAK_CLIENT_ID,
      client_secret: env.KEYCLOAK_CLIENT_SECRET,
      code_verifier: codeVerifier,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Keycloak token exchange failed with status ${response.status}`);
  return (await response.json()) as KeycloakTokens;
}

export interface KeycloakIdentity {
  sub: string;
  email: string;
  name: string | null;
  locale: string | null;
  realmRoles: string[];
}

export async function verifyIdToken(idToken: string, expectedNonce: string): Promise<KeycloakIdentity> {
  const env = getEnv();
  const { payload } = await jwtVerify(idToken, getJwks(), { issuer: urls().issuer, audience: env.KEYCLOAK_CLIENT_ID });
  if (payload.nonce !== expectedNonce) throw new Error("OIDC nonce mismatch");
  return identityFrom(payload);
}

/** Realm roles come from the access token (Keycloak's default `roles` scope). */
export async function readRealmRoles(accessToken: string): Promise<string[]> {
  const { payload } = await jwtVerify(accessToken, getJwks(), { issuer: urls().issuer });
  return ((payload.realm_access as { roles?: string[] } | undefined)?.roles ?? []).filter((r) => typeof r === "string");
}

function identityFrom(payload: JWTPayload): KeycloakIdentity {
  if (!payload.sub || typeof payload.email !== "string") throw new Error("ID token missing sub/email");
  return {
    sub: payload.sub,
    email: payload.email,
    name: typeof payload.name === "string" ? payload.name : null,
    locale: typeof payload.locale === "string" ? payload.locale : null,
    realmRoles: [],
  };
}

export function buildLogoutUrl(idTokenHint: string | null) {
  const env = getEnv();
  const url = new URL(urls().endSession);
  url.searchParams.set("client_id", env.KEYCLOAK_CLIENT_ID);
  url.searchParams.set("post_logout_redirect_uri", `${env.APP_URL}/`);
  if (idTokenHint) url.searchParams.set("id_token_hint", idTokenHint);
  return url.toString();
}

/** Health probe used by `npm run check:infra`. */
export async function checkKeycloakDiscovery(): Promise<{ issuer: string }> {
  const response = await fetch(urls().discovery, { cache: "no-store" });
  if (!response.ok) throw new Error(`Keycloak discovery returned ${response.status}`);
  return (await response.json()) as { issuer: string };
}
