"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HypeiLogo } from "@/components/brand/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NAV_GROUPS } from "./nav-items";

export function AppSidebar({ allowedHrefs }: { allowedHrefs: string[] }) {
  const pathname = usePathname();
  const allowed = new Set(allowedHrefs);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <Link href="/dashboard" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <HypeiLogo showWordmark className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => allowed.has(item.href));
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={isActive}
                          tooltip={item.label}
                          render={
                            <Link href={item.href}>
                              <item.icon />
                              <span>{item.label}</span>
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
    </Sidebar>
  );
}
