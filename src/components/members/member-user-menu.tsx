"use client";

import { LogOutIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Identity + sign-out for students, who never see the producer topbar. */
export function MemberUserMenu({ name, email }: { name: string; email: string }) {
  const initials = (name || email).slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Sua conta"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted font-heading text-xs font-semibold text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {initials}
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate font-medium">{name || "Minha conta"}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
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
  );
}
