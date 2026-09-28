import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPrisma } from "@/lib/database/postgres/client";

export const metadata = { title: "Admin" };

/** Planned modules; each becomes its own route as Phase 2 lands. */
const MODULES = [
  { title: "Organizações", description: "Produtores, status e limites." },
  { title: "Usuários", description: "Contas, acessos e papéis." },
  { title: "Pagamentos", description: "Busca por pagamento, transação e reconciliação." },
  { title: "Saques", description: "Fila de payouts e aprovações manuais." },
  { title: "Disputas", description: "Chargebacks abertos e prazos de evidência." },
  { title: "Risco", description: "Sinais, reservas e bloqueios." },
  { title: "Compliance", description: "KYC/KYB, AML e sanções." },
  { title: "Receita da plataforma", description: "Taxas Ripay por período e por país." },
];

export default async function AdminHomePage() {
  const prisma = getPrisma();
  const [organizations, users, payments, disputes] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.payment.count({ where: { status: "PAID" } }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
  ]);

  return (
    <>
      <PageHeader title="Visão da plataforma" description="Números agregados de toda a Ripay." />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Organizações" value={String(organizations)} />
        <StatCard label="Usuários" value={String(users)} />
        <StatCard label="Pagamentos confirmados" value={String(payments)} tone="positive" />
        <StatCard label="Disputas abertas" value={String(disputes)} tone={disputes > 0 ? "warning" : "muted"} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Módulos administrativos</CardTitle>
          <CardDescription>Estrutura preparada; as telas chegam nas próximas fases.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((module) => (
            <div key={module.title} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{module.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{module.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
