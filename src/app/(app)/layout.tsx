import { AppSidebar } from "@/components/layout/app-sidebar";
import { NAV_GROUPS } from "@/components/layout/nav-items";
import { Topbar } from "@/components/layout/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireOrganization } from "@/modules/organizations/current-organization";
import { hasPermission } from "@/modules/organizations/permissions";
import { getServices } from "@/server/container";
import { switchOrganization } from "./actions";

/** Producer dashboard shell. Tenant + role are resolved server-side on every request. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { organization, membership, userId } = await requireOrganization();
  const services = getServices();
  const [memberships, user] = await Promise.all([
    services.organizations.listForUser(userId),
    services.uow.repos.users.findById(userId),
  ]);

  const allowedHrefs = NAV_GROUPS.flatMap((g) => g.items)
    .filter((item) => hasPermission(membership.role, item.permission))
    .map((item) => item.href);

  return (
    <SidebarProvider>
      <AppSidebar allowedHrefs={allowedHrefs} />
      <SidebarInset>
        <Topbar
          organizations={memberships.map((m) => ({ id: m.organization.id, name: m.organization.name, role: m.role }))}
          currentOrganizationId={organization.id}
          currentOrganizationName={organization.name}
          userName={user?.name ?? ""}
          userEmail={user?.email ?? ""}
          switchOrganization={switchOrganization}
        />
        <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
