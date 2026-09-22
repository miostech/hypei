import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@/generated/prisma/client";
import { getEnv } from "@/lib/env";
import { setRequestContext } from "@/lib/logger/request-context";
import { getServices } from "@/server/container";
import { SESSION_COOKIE, verifyToken, type SessionClaims } from "./session-token";

export const getSession = cache(async (): Promise<SessionClaims | null> => {
  const store = await cookies();
  return verifyToken<SessionClaims>(store.get(SESSION_COOKIE)?.value, getEnv().SESSION_SECRET);
});

/** Current Hypei user (or null). Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await getSession();
  if (!session) return null;
  const user = await getServices().uow.repos.users.findById(session.uid);
  if (!user || user.keycloakUserId !== session.sub) return null;
  setRequestContext({ userId: user.id });
  return user;
});

export async function requireUser(returnTo = "/dashboard"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function requirePlatformAdmin(): Promise<User> {
  const user = await requireUser("/admin");
  if (user.platformRole !== "PLATFORM_ADMIN") redirect("/dashboard");
  return user;
}
