import {
  BarChart3Icon,
  BanknoteIcon,
  BookOpenIcon,
  CreditCardIcon,
  type LucideIcon,
  LayoutDashboardIcon,
  LinkIcon,
  PackageIcon,
  PlugIcon,
  ReceiptIcon,
  RepeatIcon,
  RotateCcwIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  TagIcon,
  TicketIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import type { Permission } from "@/modules/organizations/permissions";

import type { Route } from "next";

export interface NavItem {
  href: Route;
  label: string;
  icon: LucideIcon;
  permission: Permission;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão geral",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon, permission: "organization:read" },
      { href: "/sales", label: "Vendas", icon: ShoppingBagIcon, permission: "sales:read" },
      { href: "/refunds", label: "Reembolsos", icon: RotateCcwIcon, permission: "sales:read" },
      { href: "/analytics", label: "Analytics", icon: BarChart3Icon, permission: "analytics:read" },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { href: "/products", label: "Produtos", icon: PackageIcon, permission: "products:read" },
      { href: "/offers", label: "Ofertas", icon: TagIcon, permission: "products:read" },
      { href: "/checkouts", label: "Checkout", icon: CreditCardIcon, permission: "products:read" },
      { href: "/coupons", label: "Cupons", icon: TicketIcon, permission: "products:read" },
    ],
  },
  {
    label: "Clientes",
    items: [
      { href: "/customers", label: "Clientes", icon: UsersIcon, permission: "customers:read" },
      { href: "/subscriptions", label: "Assinaturas", icon: RepeatIcon, permission: "sales:read" },
      { href: "/members-area", label: "Área de membros", icon: BookOpenIcon, permission: "products:read" },
      { href: "/affiliates", label: "Afiliados", icon: LinkIcon, permission: "sales:read" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/finance", label: "Financeiro", icon: ReceiptIcon, permission: "finance:read" },
      { href: "/payouts", label: "Saques", icon: BanknoteIcon, permission: "finance:read" },
    ],
  },
  {
    label: "Conta",
    items: [
      { href: "/verification", label: "Verificação", icon: ShieldCheckIcon, permission: "organization:read" },
      { href: "/integrations", label: "Integrações", icon: PlugIcon, permission: "organization:read" },
      { href: "/settings", label: "Configurações", icon: SettingsIcon, permission: "organization:read" },
    ],
  },
];

export const WALLET_ICON = WalletIcon;
