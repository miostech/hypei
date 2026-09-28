import { PackageIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { createCourse } from "../actions";
import { CourseForm } from "../course-form";

export const metadata = { title: "Novo curso" };

export default async function NewCoursePage() {
  const { organization } = await requirePagePermission("products:write");
  const products = await getServices().courses.availableProducts(organization.id);

  if (products.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Área de membros" title="Novo curso" />
        <EmptyState
          icon={PackageIcon}
          title="Nenhum produto disponível"
          description="Cada curso pertence a um produto, e cada produto pode ter um curso. Crie um novo produto para continuar."
          action={<Button render={<Link href="/products/new" />}>Criar produto</Button>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Área de membros" title="Novo curso" description="O curso fica ligado a um produto: quem compra, entra." />
      <div className="max-w-2xl">
        <CourseForm
          action={createCourse}
          products={products.map((product) => ({ id: product.id, name: product.name }))}
          defaultValues={{ productId: products[0].id, title: "", slug: "", description: "" }}
          submitLabel="Criar curso"
          title="Informações do curso"
          description="Você organiza os módulos e as aulas no próximo passo."
        />
      </div>
    </>
  );
}
