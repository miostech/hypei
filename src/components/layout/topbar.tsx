"use client";

import { CheckIcon, ChevronsUpDownIcon, LanguagesIcon, LogOutIcon, PlusIcon, SettingsIcon } from "lucide-react";
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAppDictionary } from "@/lib/i18n/app/provider";
import type { Locale } from "@/lib/i18n/locale";

export interface OrganizationOption {
  id: string;
  name: string;
  role: string;
}

export interface LanguageOption {
  locale: Locale;
  name: string;
}

export function Topbar({
  organizations,
  currentOrganizationId,
  currentOrganizationName,
  currentRole,
  userName,
  userEmail,
  switchOrganization,
  languages,
  currentLocale,
  setLanguage,
  awards,
}: {
  organizations: OrganizationOption[];
  currentOrganizationId: string;
  currentOrganizationName: string;
  currentRole: string;
  userName: string;
  userEmail: string;
  switchOrganization: (organizationId: string) => Promise<void>;
  languages: LanguageOption[];
  currentLocale: Locale;
  setLanguage: (locale: Locale) => Promise<void>;
  /** Rendered on the server so the topbar itself never loads data. */
  awards?: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const dict = useAppDictionary();
  const initials = (userName || userEmail).slice(0, 2).toUpperCase();
  const orgInitials = currentOrganizationName.slice(0, 2).toUpperCase();
  // O papel vem do banco como enum; um papel novo ainda sem tradução aparece com o próprio
  // nome em vez de sumir do cabeçalho.
  const role = dict.roles[currentRole as keyof typeof dict.roles] ?? currentRole;

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
                <span className="block text-[0.7rem] text-muted-foreground">{role}</span>
              </span>
              <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
            </button>
          }
        />
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">{dict.topbar.organizations}</DropdownMenuLabel>
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
            {dict.topbar.newOrganization}
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
                aria-label={dict.topbar.account}
                className="flex size-9 items-center justify-center rounded-xl bg-muted font-heading text-xs font-semibold text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {initials}
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="truncate font-medium">{userName || dict.topbar.myAccount}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">{userEmail}</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>
              <SettingsIcon />
              {dict.topbar.settings}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <LanguagesIcon />
                {dict.topbar.language}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-44">
                {languages.map((language) => (
                  <DropdownMenuItem
                    key={language.locale}
                    lang={language.locale}
                    onClick={() => startTransition(() => setLanguage(language.locale))}
                  >
                    <span className="flex-1 truncate">{language.name}</span>
                    {language.locale === currentLocale && <CheckIcon className="size-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <form action="/api/auth/logout" method="post">
                  <button type="submit" className="flex w-full items-center gap-2">
                    <LogOutIcon className="size-4" />
                    {dict.topbar.signOut}
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
