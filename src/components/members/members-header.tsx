import { ArrowLeftIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { MemberUserMenu } from "./member-user-menu";

/** Shared chrome for every student page: context on the left, identity on the right. */
export function MembersHeader({
  title,
  subtitle,
  backHref,
  meta,
  user,
  sticky = false,
  className,
}: {
  title: string;
  subtitle?: string;
  backHref?: Route;
  /** Badge or counter shown before the account menu. */
  meta?: ReactNode;
  user: { name: string | null; email: string };
  sticky?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("border-b bg-card", sticky && "sticky top-0 z-20 bg-card/95 backdrop-blur", className)}>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
        {backHref && (
          <Button variant="ghost" size="icon-sm" aria-label="Voltar" render={<Link href={backHref} />}>
            <ArrowLeftIcon />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading font-semibold">{title}</p>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {meta}
        <MemberUserMenu name={user.name ?? ""} email={user.email} />
      </div>
    </header>
  );
}
