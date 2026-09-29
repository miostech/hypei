"use client";

import { CheckIcon, ChevronsUpDownIcon, LogOutIcon, PlusIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { useTransition, type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";

export interface OrganizationOption {
  id: string;
  name: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  FINANCE: "Financeiro",
  SUPPORT: "Suporte",
  MARKETING: "Marketing",
  VIEWER: "Visualizador",
};

export function Topbar({
  organizations,
  currentOrganizationId,
  currentOrganizationName,
  currentRole,
  userName,
  userEmail,
  switchOrganization,
  awards,
}: {
  organizations: OrganizationOption[];
  currentOrganizationId: string;
  currentOrganizationName: string;
  currentRole: string;
  userName: string;
  userEmail: string;
  switchOrganization: (organizationId: string) => Promise<void>;
  /** Rendered on the server so the topbar itself never loads data. */
  awards?: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const initials = (userName || userEmail).slice(0, 2).toUpperCase();
  const orgInitials = currentOrganizationName.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md">
      <SidebarTrigger className="text-muted-foreground" />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              disabled={pending}
              className="flex items-center gap-2.5 rounded-xl py-1.5 pr-2.5 pl-1.5 transition-colors hover:bg-muted"
            >
              <span className="bg-brand-gradient flex size-8 items-center justify-center rounded-lg font-heading text-xs font-bold text-white">
                {orgInitials}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block max-w-44 truncate text-sm font-medium">{currentOrganizationName}</span>
                <span className="block text-[0.7rem] text-muted-foreground">{ROLE_LABELS[currentRole] ?? currentRole}</span>
              </span>
              <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
            </button>
          }
        />
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Suas organizações</DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem key={org.id} onClick={() => startTransition(() => switchOrganization(org.id))}>
                <span className="flex-1 truncate">{org.name}</span>
                {org.id === currentOrganizationId && <CheckIcon className="size-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/onboarding?new=1" />}>
            <PlusIcon />
            Nova organização
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-2">
        {awards}
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Conta"
                className="flex size-9 items-center justify-center rounded-xl bg-muted font-heading text-xs font-semibold text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {initials}
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="truncate font-medium">{userName || "Minha conta"}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">{userEmail}</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>
              <SettingsIcon />
              Configurações
            </DropdownMenuItem>
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
