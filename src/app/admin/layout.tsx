import Link from "next/link";
import { KabrunLogo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import pt from "@/lib/i18n/app/pt";
import { AppDictionaryProvider } from "@/lib/i18n/app/provider";
import { requirePlatformAdmin } from "@/modules/auth/current-user";
import { AdminNav } from "./admin-nav";

/** Kabrun staff area. Requires the platform_admin realm role, re-checked against the DB. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requirePlatformAdmin();
  return (
    // O admin é da equipe Kabrun e segue em português; o provider existe porque os componentes
    // compartilhados leem o dicionário do contexto, e sem ele o SubmitButton quebra.
    <AppDictionaryProvider dict={pt}>
      <div className="flex min-h-svh flex-col">
        <header className="border-b bg-background">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
            <Link href="/admin">
              <KabrunLogo />
            </Link>
            <Badge variant="secondary">Admin da plataforma</Badge>
            <Link href="/dashboard" className="ml-auto text-sm text-muted-foreground hover:underline">
              Voltar ao painel
            </Link>
          </div>
        </header>
        <div className="border-b bg-background">
          <div className="mx-auto w-full max-w-6xl px-4 pb-2">
            <AdminNav />
          </div>
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 sm:p-6">{children}</main>
      </div>
    </AppDictionaryProvider>
  );
}
