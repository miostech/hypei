import type { Organization, OrganizationMember } from "@/generated/prisma/client";
import type { OrganizationRole } from "@/generated/prisma/enums";
import { ForbiddenError } from "@/lib/errors";
import type { OrganizationRepository } from "./organization.repository";
import { hasPermission, type Permission } from "./permissions";

export interface TenantContext {
  userId: string;
  organization: Organization;
  membership: OrganizationMember;
}

/**
 * Resolves the tenant for a user. The organizationId coming from the client (cookie, form,
 * URL) is NEVER trusted: membership is always verified against the database.
 */
export async function resolveTenant(
  organizations: OrganizationRepository,
  userId: string,
  requestedOrganizationId: string | null | undefined,
): Promise<TenantContext | null> {
  if (requestedOrganizationId) {
    const membership = await organizations.findMembership(requestedOrganizationId, userId);
    if (membership) return { userId, organization: membership.organization, membership };
  }
  const [first] = await organizations.listMemberships(userId);
  return first ? { userId, organization: first.organization, membership: first } : null;
}

export function assertRole(ctx: TenantContext, roles: OrganizationRole[]): void {
  if (!roles.includes(ctx.membership.role)) throw new ForbiddenError();
}

export function assertPermission(ctx: TenantContext, permission: Permission): void {
  if (!hasPermission(ctx.membership.role, permission)) throw new ForbiddenError();
}
