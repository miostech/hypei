import {
  BarChart3Icon,
  BanknoteIcon,
  BookOpenIcon,
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
  /** Rotas que são abas desta tela: continuam acendendo o item do menu. */
  tabs?: string[];
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
      { href: "/products", key: "products", icon: PackageIcon, permission: "products:read", tabs: ["/affiliations"] },
      // Preço e checkout agora são abas do produto. As telas /offers e /checkouts continuam de pé
      // — a aba leva para elas —, mas não competem mais com o produto no menu.
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
      // "Minhas afiliações" — o que a pessoa divulga de outros produtores — virou aba de Produtos,
      // ao lado dos produtos dela. É a mesma pergunta: de que produtos eu tiro dinheiro?
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
