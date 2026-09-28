import Link from "next/link";
import { RipayLogo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { requirePlatformAdmin } from "@/modules/auth/current-user";

/** Ripay staff area. Requires the platform_admin realm role, re-checked against the DB. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requirePlatformAdmin();
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
          <Link href="/admin">
            <RipayLogo />
          </Link>
          <Badge variant="secondary">Admin da plataforma</Badge>
          <Link href="/dashboard" className="ml-auto text-sm text-muted-foreground hover:underline">
            Voltar ao painel
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 sm:p-6">{children}</main>
    </div>
  );
}
