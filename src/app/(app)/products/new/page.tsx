import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { createProduct } from "../actions";
import { ProductForm } from "../product-form";

export const metadata = { title: "Novo produto" };

export default async function NewProductPage() {
  await requirePagePermission("products:write");
  return (
    <>
      <PageHeader title="Novo produto" description="Cadastre o que você vende. O preço fica nas ofertas." />
      <ProductForm
        action={createProduct}
        submitLabel="Criar produto"
        defaultValues={{ name: "", slug: "", description: "", type: "COURSE", status: "ACTIVE", thumbnailUrl: "" }}
      />
    </>
  );
}
