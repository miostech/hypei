"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ForbiddenError } from "@/lib/errors";
import { requireUser } from "@/modules/auth/current-user";
import { cookieOptions, ORGANIZATION_COOKIE } from "@/modules/auth/session-token";
import { getServices } from "@/server/container";

/** Switches the active tenant. Membership is verified before the cookie is written. */
export async function switchOrganization(organizationId: string): Promise<void> {
  const user = await requireUser();
  const membership = await getServices().uow.repos.organizations.findMembership(organizationId, user.id);
  if (!membership) throw new ForbiddenError("Você não faz parte desta organização");
  const store = await cookies();
  store.set(ORGANIZATION_COOKIE, organizationId, cookieOptions(60 * 60 * 24 * 30));
  revalidatePath("/", "layout");
}
