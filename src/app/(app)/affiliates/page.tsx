import { LinkIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/modules/organizations/current-organization";

export const metadata = { title: "Afiliados" };

export default async function AffiliatesPage() {
  await requirePagePermission("sales:read");
  return (
    <>
      <PageHeader title="Afiliados" description="Parceiros que vendem seus produtos e recebem comissão." />
      <EmptyState
        icon={LinkIcon}
        title="Programa de afiliados em breve"
        description="O modelo de dados já existe: a comissão só fica disponível depois que a venda sai da janela de reembolso e chargeback."
      />
    </>
  );
}
