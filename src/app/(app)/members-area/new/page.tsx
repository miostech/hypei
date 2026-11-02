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

export default async function NewCoursePage({ searchParams }: PageProps<"/members-area/new">) {
  const { organization } = await requirePagePermission("products:write");
  const [products, params] = await Promise.all([getServices().courses.availableProducts(organization.id), searchParams]);

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

  // Quem chega pelo aviso de produto sem conteúdo já traz o produto na URL: pré-selecionar
  // evita criar o conteúdo no produto errado, que é irreversível (um conteúdo por produto).
  const requested = typeof params.productId === "string" ? params.productId : null;
  const selected = products.find((product) => product.id === requested)?.id ?? products[0].id;

  return (
    <>
      <PageHeader eyebrow="Área de membros" title="Novo curso" description="O curso fica ligado a um produto: quem compra, entra." />
      <div className="max-w-2xl">
        <CourseForm
          action={createCourse}
          products={products.map((product) => ({ id: product.id, name: product.name }))}
          defaultValues={{ productId: selected, title: "", slug: "", description: "" }}
          submitLabel="Criar curso"
          title="Informações do curso"
          description="Você organiza os módulos e as aulas no próximo passo."
        />
      </div>
    </>
  );
}
