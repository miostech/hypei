import { BookOpenIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";

export const metadata = { title: "Área de membros" };

export default async function MembersAreaPage() {
  const { organization } = await requirePagePermission("products:read");
  const courses = await getServices().uow.repos.courses.listPublished(organization.id);

  return (
    <>
      <PageHeader
        title="Área de membros"
        description="Onde seus alunos acessam o conteúdo comprado. O acesso é liberado automaticamente quando o pagamento é confirmado."
        actions={
          <Button variant="outline" render={<Link href={`/members/${organization.slug}`} target="_blank" />}>
            <ExternalLinkIcon />
            Ver área de membros
          </Button>
        }
      />
      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpenIcon}
          title="Nenhum curso publicado"
          description="Crie um produto do tipo curso e publique os módulos e aulas. O editor de conteúdo chega na próxima fase."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id}>
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-medium">{course.title}</h2>
                  <Badge variant="success">Publicado</Badge>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{course.description ?? "Sem descrição"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
