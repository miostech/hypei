"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KabrunLogo, KabrunMark } from "@/components/brand/logo";
import { useAppDictionary } from "@/lib/i18n/app/provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NAV_GROUPS } from "./nav-items";

export function AppSidebar({ allowedHrefs, testEnvironment }: { allowedHrefs: string[]; testEnvironment: boolean }) {
  const pathname = usePathname();
  const dict = useAppDictionary();
  const allowed = new Set(allowedHrefs);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-4 py-5 group-data-[collapsible=icon]:px-2">
        <Link href="/dashboard" aria-label="Kabrun" className="flex items-center gap-2.5">
          <KabrunLogo variant="knockout" className="group-data-[collapsible=icon]:hidden" />
          <KabrunMark className="hidden size-8 group-data-[collapsible=icon]:block" />
        </Link>
      </SidebarHeader>

      <SidebarContent className="scrollbar-slim px-2">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => allowed.has(item.href));
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.key} className="py-1.5">
              <SidebarGroupLabel className="px-2 text-[0.65rem] font-semibold tracking-[0.12em] text-sidebar-foreground/45 uppercase">
                {dict.nav.groups[group.key]}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={isActive}
                          tooltip={dict.nav.items[item.key]}
                          className="h-9 rounded-xl text-sidebar-foreground/75 transition-colors hover:bg-white/8 hover:text-white data-[active=true]:bg-white/12 data-[active=true]:font-medium data-[active=true]:text-white [&>svg]:size-4.5"
                          render={
                            <Link href={item.href}>
                              <item.icon />
                              <span>{dict.nav.items[item.key]}</span>
                            </Link>
                          }
                        />
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {testEnvironment && (
        <SidebarFooter className="p-3 group-data-[collapsible=icon]:hidden">
          <p className="flex items-center gap-2 rounded-xl bg-white/6 px-3 py-2.5 text-[0.7rem] font-medium text-white ring-1 ring-white/10">
            <span className="size-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
            <span className="truncate">{dict.nav.testEnvironment}</span>
          </p>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
