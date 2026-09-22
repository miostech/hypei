import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { OrganizationRole } from "@/generated/prisma/enums";
import { ForbiddenError } from "@/lib/errors";
import { setRequestContext } from "@/lib/logger/request-context";
import { requireUser } from "@/modules/auth/current-user";
import { ORGANIZATION_COOKIE } from "@/modules/auth/session-token";
import { getServices } from "@/server/container";
import type { Permission } from "./permissions";
import { assertPermission, assertRole, resolveTenant, type TenantContext } from "./tenant-access";

/**
 * Resolves the active organization for the signed-in user. The org id stored in the cookie
 * is only a preference: membership is re-verified against the database on every request.
 */
export const requireOrganization = cache(async (): Promise<TenantContext> => {
  const user = await requireUser();
  const store = await cookies();
  const ctx = await resolveTenant(getServices().uow.repos.organizations, user.id, store.get(ORGANIZATION_COOKIE)?.value);
  if (!ctx) redirect("/onboarding");
  setRequestContext({ organizationId: ctx.organization.id });
  return ctx;
});

export async function requireRole(roles: OrganizationRole[]): Promise<TenantContext> {
  const ctx = await requireOrganization();
  assertRole(ctx, roles);
  return ctx;
}

export async function requirePermission(permission: Permission): Promise<TenantContext> {
  const ctx = await requireOrganization();
  assertPermission(ctx, permission);
  return ctx;
}

/** Page-level variant: renders the 403 page instead of throwing. */
export async function requirePagePermission(permission: Permission): Promise<TenantContext> {
  try {
    return await requirePermission(permission);
  } catch (error) {
    if (error instanceof ForbiddenError) redirect("/dashboard?forbidden=1");
    throw error;
  }
}
