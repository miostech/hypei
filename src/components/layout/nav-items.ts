import {
  BarChart3Icon,
  BanknoteIcon,
  BookOpenIcon,
  CreditCardIcon,
  HandshakeIcon,
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
import type { AppDictionary } from "@/lib/i18n/app";
import type { Permission } from "@/modules/organizations/permissions";

import type { Route } from "next";

/**
 * O menu guarda a chave do rótulo, não o rótulo.
 *
 * Quem desenha a barra lateral é client component e lê o texto do dicionário; deixar a palavra
 * aqui obrigaria este módulo a conhecer o idioma, e ele é só a lista de onde se pode ir.
 */
export interface NavItem {
  href: Route;
  key: keyof AppDictionary["nav"]["items"];
  icon: LucideIcon;
  permission: Permission;
}

export interface NavGroup {
  key: keyof AppDictionary["nav"]["groups"];
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "overview",
    items: [
      { href: "/dashboard", key: "dashboard", icon: LayoutDashboardIcon, permission: "organization:read" },
      { href: "/sales", key: "sales", icon: ShoppingBagIcon, permission: "sales:read" },
      { href: "/refunds", key: "refunds", icon: RotateCcwIcon, permission: "sales:read" },
      { href: "/analytics", key: "analytics", icon: BarChart3Icon, permission: "analytics:read" },
    ],
  },
  {
    key: "catalog",
    items: [
      { href: "/products", key: "products", icon: PackageIcon, permission: "products:read" },
      { href: "/offers", key: "offers", icon: TagIcon, permission: "products:read" },
      { href: "/checkouts", key: "checkouts", icon: CreditCardIcon, permission: "products:read" },
      { href: "/coupons", key: "coupons", icon: TicketIcon, permission: "products:read" },
    ],
  },
  {
    key: "customers",
    items: [
      { href: "/customers", key: "customers", icon: UsersIcon, permission: "customers:read" },
      { href: "/subscriptions", key: "subscriptions", icon: RepeatIcon, permission: "sales:read" },
      { href: "/members-area", key: "membersArea", icon: BookOpenIcon, permission: "products:read" },
      { href: "/affiliates", key: "affiliates", icon: LinkIcon, permission: "sales:read" },
      // Esta é a única entrada do menu que não é sobre a operação da organização, e sim sobre a
      // pessoa: o que ela divulga de outros produtores. Por isso a permissão mais frouxa.
      { href: "/affiliations", key: "affiliations", icon: HandshakeIcon, permission: "organization:read" },
    ],
  },
  {
    key: "finance",
    items: [
      { href: "/finance", key: "finance", icon: ReceiptIcon, permission: "finance:read" },
      { href: "/payouts", key: "payouts", icon: BanknoteIcon, permission: "finance:read" },
    ],
  },
  {
    key: "account",
    items: [
      { href: "/verification", key: "verification", icon: ShieldCheckIcon, permission: "organization:read" },
      { href: "/integrations", key: "integrations", icon: PlugIcon, permission: "organization:read" },
      { href: "/settings", key: "settings", icon: SettingsIcon, permission: "organization:read" },
    ],
  },
];

export const WALLET_ICON = WalletIcon;
