import { PackageIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { createCourse } from "../actions";
import { CourseForm } from "../course-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAppDictionary(await appLocale())).membersArea.new.title };
}

export default async function NewCoursePage({ searchParams }: PageProps<"/members-area/new">) {
  const { organization } = await requirePagePermission("products:write");
  const [products, params] = await Promise.all([getServices().courses.availableProducts(organization.id), searchParams]);
  const dict = await getAppDictionary(await appLocale());
  const t = dict.membersArea;

  if (products.length === 0) {
    return (
      <>
        <PageHeader eyebrow={t.eyebrow} title={t.new.title} />
        <EmptyState
          icon={PackageIcon}
          title={t.new.noProductTitle}
          description={t.new.noProductBody}
          action={<Button render={<Link href="/products/new" />}>{t.createProduct}</Button>}
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
      <PageHeader eyebrow={t.eyebrow} title={t.new.title} description={t.new.description} />
      <div className="max-w-2xl">
        <CourseForm
          action={createCourse}
          products={products.map((product) => ({ id: product.id, name: product.name }))}
          defaultValues={{ productId: selected, title: "", slug: "", description: "" }}
          submitLabel={t.createCourse}
          title={t.new.formTitle}
          description={t.new.formDescription}
        />
      </div>
    </>
  );
}
