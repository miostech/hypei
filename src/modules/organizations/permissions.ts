import type { OrganizationRole } from "@/generated/prisma/enums";

export const PERMISSIONS = [
  "organization:read",
  "organization:manage",
  "members:manage",
  "products:read",
  "products:write",
  "checkout:write",
  "customers:read",
  "sales:read",
  "finance:read",
  "payouts:request",
  "refunds:create",
  "analytics:read",
  "integrations:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL = new Set<Permission>(PERMISSIONS);

/** Authorization is Ripay's responsibility (Keycloak only authenticates). */
export const ROLE_PERMISSIONS: Record<OrganizationRole, ReadonlySet<Permission>> = {
  OWNER: ALL,
  ADMIN: new Set(PERMISSIONS.filter((p) => p !== "members:manage")),
  FINANCE: new Set<Permission>(["organization:read", "products:read", "sales:read", "customers:read", "finance:read", "payouts:request", "refunds:create"]),
  SUPPORT: new Set<Permission>(["organization:read", "products:read", "sales:read", "customers:read", "refunds:create"]),
  MARKETING: new Set<Permission>(["organization:read", "products:read", "products:write", "checkout:write", "analytics:read", "sales:read"]),
  VIEWER: new Set<Permission>(["organization:read", "products:read", "sales:read", "analytics:read"]),
};

export function hasPermission(role: OrganizationRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}
