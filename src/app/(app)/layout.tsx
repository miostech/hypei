import { AwardsProgressSlot } from "@/components/awards/awards-progress-slot";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NAV_GROUPS } from "@/components/layout/nav-items";
import { Topbar } from "@/components/layout/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getAppDictionary, languageOptions } from "@/lib/i18n/app";
import { AppDictionaryProvider } from "@/lib/i18n/app/provider";
import { appLocale } from "@/lib/i18n/app/server";
import { requireOrganization } from "@/modules/organizations/current-organization";
import { hasPermission } from "@/modules/organizations/permissions";
import { getServices } from "@/server/container";
import { setLanguage, switchOrganization } from "./actions";

/** Producer dashboard shell. Tenant + role are resolved server-side on every request. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { organization, membership, userId } = await requireOrganization();
  const services = getServices();
  const locale = await appLocale();
  const [memberships, user, dict, languages] = await Promise.all([
    services.organizations.listForUser(userId),
    services.uow.repos.users.findById(userId),
    getAppDictionary(locale),
    languageOptions(),
  ]);

  const allowedHrefs = NAV_GROUPS.flatMap((g) => g.items)
    .filter((item) => hasPermission(membership.role, item.permission))
    .map((item) => item.href);

  return (
    <AppDictionaryProvider dict={dict}>
      <SidebarProvider>
        <AppSidebar allowedHrefs={allowedHrefs} testEnvironment={services.paymentProvider.type === "MOCK"} />
        <SidebarInset lang={dict.localeTag} className="bg-background">
          <Topbar
            organizations={memberships.map((m) => ({ id: m.organization.id, name: m.organization.name, role: m.role }))}
            currentOrganizationId={organization.id}
            currentOrganizationName={organization.name}
            currentRole={membership.role}
            userName={user?.name ?? ""}
            userEmail={user?.email ?? ""}
            switchOrganization={switchOrganization}
            languages={languages}
            currentLocale={locale}
            setLanguage={setLanguage}
            awards={<AwardsProgressSlot organizationId={organization.id} />}
          />
          <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </AppDictionaryProvider>
  );
}
