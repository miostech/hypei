import { BookOpenIcon, ExternalLinkIcon, PlusIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { hasPermission } from "@/modules/organizations/permissions";
import { getServices } from "@/server/container";

export const metadata = { title: "Área de membros" };

export default async function MembersAreaPage() {
  const { organization, membership } = await requirePagePermission("products:read");
  const services = getServices();
  const [courses, products] = await Promise.all([
    services.courses.list(organization.id),
    services.courses.availableProducts(organization.id),
  ]);
  const canEdit = hasPermission(membership.role, "products:write");

  return (
    <>
      <PageHeader
        eyebrow="Área de membros"
        title="Conteúdo dos seus alunos"
        description="O acesso é liberado automaticamente quando o pagamento do produto é confirmado."
        actions={
          <>
            <Button variant="outline" render={<Link href={`/members/${organization.slug}`} target="_blank" />}>
              <ExternalLinkIcon />
              Ver área de membros
            </Button>
            {canEdit && products.length > 0 && (
              <Button render={<Link href="/members-area/new" />}>
                <PlusIcon />
                Novo curso
              </Button>
            )}
          </>
        }
      />

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpenIcon}
          title="Nenhum curso criado"
          description={
            products.length > 0
              ? "Crie um curso, organize os módulos e publique. Quem comprar o produto entra automaticamente."
              : "Todos os seus produtos já têm curso. Crie um novo produto para começar outro conteúdo."
          }
          action={
            canEdit && products.length > 0 ? (
              <Button render={<Link href="/members-area/new" />}>
                <PlusIcon />
                Criar curso
              </Button>
            ) : (
              <Button variant="outline" render={<Link href="/products/new" />}>
                Criar produto
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link key={course.id} href={`/members-area/${course.id}`} className="group">
              <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:border-primary/25 group-hover:shadow-card">
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="bg-brand-gradient flex size-10 items-center justify-center rounded-xl text-white">
                      <BookOpenIcon className="size-5" aria-hidden />
                    </span>
                    <Badge variant={course.published ? "success" : "outline"}>{course.published ? "Publicado" : "Rascunho"}</Badge>
                  </div>
                  <div className="flex-1">
                    <h2 className="font-heading font-semibold">{course.title}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{course.product.name}</p>
                    {course.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>}
                  </div>
                  <div className="flex items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
                    <span>{course._count.modules} módulo(s)</span>
                    <span className="flex items-center gap-1">
                      <UsersIcon className="size-3.5" aria-hidden />
                      {course._count.enrollments} aluno(s)
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
