"use client";

import { BuildingIcon, CheckIcon, ChevronsUpDownIcon, LogOutIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export interface OrganizationOption {
  id: string;
  name: string;
  role: string;
}

export function Topbar({
  organizations,
  currentOrganizationId,
  currentOrganizationName,
  userName,
  userEmail,
  switchOrganization,
}: {
  organizations: OrganizationOption[];
  currentOrganizationId: string;
  currentOrganizationName: string;
  userName: string;
  userEmail: string;
  switchOrganization: (organizationId: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const initials = (userName || userEmail).slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-sm">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-1 h-5" />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="sm" className="gap-2" disabled={pending}>
              <BuildingIcon />
              <span className="max-w-40 truncate">{currentOrganizationName}</span>
              <ChevronsUpDownIcon className="text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel>Suas organizações</DropdownMenuLabel>
          {organizations.map((org) => (
            <DropdownMenuItem key={org.id} onClick={() => startTransition(() => switchOrganization(org.id))}>
              <span className="flex-1 truncate">{org.name}</span>
              <span className="text-xs text-muted-foreground">{org.role}</span>
              {org.id === currentOrganizationId && <CheckIcon className="size-3.5" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/onboarding?new=1" />}>
            <PlusIcon />
            Nova organização
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Conta">
                <Avatar className="size-7">
                  <AvatarFallback className="text-[0.65rem]">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate font-medium">{userName || "Minha conta"}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{userEmail}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>Configurações</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <form action="/api/auth/logout" method="post">
                  <button type="submit" className="flex w-full items-center gap-2">
                    <LogOutIcon className="size-4" />
                    Sair
                  </button>
                </form>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
