import { BookOpenIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RipayLogo } from "@/components/brand/logo";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/modules/auth/current-user";
import { getServices } from "@/server/container";

export const metadata = { title: "Área de membros" };

export default async function MembersHomePage({ params }: PageProps<"/members/[organizationSlug]">) {
  const { organizationSlug } = await params;
  const user = await requireUser(`/members/${organizationSlug}`);
  const services = getServices();

  const organization = await services.uow.repos.organizations.findBySlug(organizationSlug);
  if (!organization) notFound();

  const courses = await services.uow.repos.courses.listPublished(organization.id);
  const access = await Promise.all(courses.map((course) => services.uow.repos.courses.hasEnrollment(course.id, user.email)));

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <div>
            <p className="font-semibold">{organization.name}</p>
            <p className="text-xs text-muted-foreground">Área de membros</p>
          </div>
          <RipayLogo className="opacity-70" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4 sm:p-6">
        {courses.length === 0 ? (
          <EmptyState icon={BookOpenIcon} title="Nenhum conteúdo publicado" description="Assim que o produtor publicar um curso, ele aparece aqui." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course, index) => {
              const unlocked = access[index];
              const card = (
                <Card key={course.id} className={unlocked ? "transition-colors hover:border-primary/40" : "opacity-70"}>
                  <CardContent className="space-y-2 pt-6">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-medium">{course.title}</h2>
                      {!unlocked && <LockIcon className="size-4 shrink-0 text-muted-foreground" aria-label="Sem acesso" />}
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{course.description ?? "Sem descrição"}</p>
                  </CardContent>
                </Card>
              );
              return unlocked ? (
                <Link key={course.id} href={`/members/${organizationSlug}/courses/${course.slug}`}>
                  {card}
                </Link>
              ) : (
                card
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
