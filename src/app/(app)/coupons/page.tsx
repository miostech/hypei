import { TicketIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/modules/organizations/current-organization";

export const metadata = { title: "Cupons" };

export default async function CouponsPage() {
  await requirePagePermission("products:read");
  return (
    <>
      <PageHeader title="Cupons" description="Descontos aplicados no checkout." />
      <EmptyState
        icon={TicketIcon}
        title="Cupons em breve"
        description="O desconto será sempre aplicado sobre o preço oficial da oferta, e registrado no pedido."
      />
    </>
  );
}
