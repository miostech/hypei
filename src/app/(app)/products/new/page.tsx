import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { createProduct } from "../actions";
import { ProductForm } from "../product-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAppDictionary(await appLocale());
  return { title: dict.productForm.newTitle };
}

export default async function NewProductPage() {
  await requirePagePermission("products:write");
  const t = (await getAppDictionary(await appLocale())).productForm;
  return (
    <>
      <PageHeader title={t.newTitle} description={t.newDescription} />
      <ProductForm
        action={createProduct}
        submitLabel={t.createSubmit}
        defaultValues={{ name: "", slug: "", description: "", type: "COURSE", status: "ACTIVE", thumbnailKey: "", thumbnailUrl: null }}
      />
    </>
  );
}
