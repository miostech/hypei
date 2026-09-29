"use client";

import { AlertTriangleIcon, BanknoteIcon, BuildingIcon, GiftIcon, type LucideIcon, LayoutDashboardIcon, ReceiptIcon, SearchIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const ITEMS: { href: Route; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboardIcon },
  { href: "/admin/organizations", label: "Organizações", icon: BuildingIcon },
  { href: "/admin/payments", label: "Pagamentos", icon: SearchIcon },
  { href: "/admin/payouts", label: "Saques", icon: BanknoteIcon },
  { href: "/admin/disputes", label: "Disputas", icon: AlertTriangleIcon },
  { href: "/admin/revenue", label: "Receita", icon: ReceiptIcon },
  { href: "/admin/awards", label: "Premiações", icon: GiftIcon },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto" aria-label="Seções do admin">
      {ITEMS.map((item) => {
        // "/admin" only matches itself; the others also match their sub-pages.
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
