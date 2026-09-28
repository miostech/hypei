import { BookOpenIcon, LockIcon, PlayCircleIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RipayLogo } from "@/components/brand/logo";
import { CourseProgressBar } from "@/components/members/course-outline";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { memberCourseHref } from "@/lib/ui/routes";
import { requireUser } from "@/modules/auth/current-user";
import { getServices } from "@/server/container";

export const metadata = { title: "Área de membros" };

export default async function MembersHomePage({ params }: PageProps<"/members/[organizationSlug]">) {
  const { organizationSlug } = await params;
  const user = await requireUser(`/members/${organizationSlug}`);
  const services = getServices();

  const organization = await services.uow.repos.organizations.findBySlug(organizationSlug);
  if (!organization) notFound();

  const courses = await services.memberArea.listForStudent(organization.id, user);

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <div>
            <p className="font-heading font-semibold">{organization.name}</p>
            <p className="text-xs text-muted-foreground">Área de membros</p>
          </div>
          <RipayLogo className="h-6 opacity-70" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 p-4 sm:p-6">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Seus cursos</h1>
          <p className="text-sm text-muted-foreground">Tudo que você comprou fica disponível aqui.</p>
        </div>

        {courses.length === 0 ? (
          <EmptyState icon={BookOpenIcon} title="Nenhum conteúdo publicado" description="Assim que o produtor publicar um curso, ele aparece aqui." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map(({ course, unlocked, percentage, completedLessons, totalLessons, preview }) => {
              const card = (
                <Card className={unlocked ? "h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-card" : "h-full opacity-70"}>
                  <CardContent className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="bg-brand-gradient flex size-10 items-center justify-center rounded-xl text-white">
                        <BookOpenIcon className="size-5" aria-hidden />
                      </span>
                      {!unlocked && <LockIcon className="size-4 text-muted-foreground" aria-label="Sem acesso" />}
                      {preview && <Badge variant="outline">Prévia</Badge>}
                    </div>

                    <div className="flex-1">
                      <h2 className="font-heading font-semibold">{course.title}</h2>
                      {course.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>}
                    </div>

                    {unlocked ? (
                      <div className="space-y-3 border-t pt-3">
                        <CourseProgressBar percentage={percentage} completed={completedLessons} total={totalLessons} />
                        <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                          <PlayCircleIcon className="size-4" aria-hidden />
                          {percentage > 0 ? "Continuar" : "Começar"}
                        </p>
                      </div>
                    ) : (
                      <p className="border-t pt-3 text-xs text-muted-foreground">Compre este produto para liberar o acesso.</p>
                    )}
                  </CardContent>
                </Card>
              );

              return unlocked ? (
                <Link key={course.id} href={memberCourseHref(organizationSlug, course.slug)} className="group">
                  {card}
                </Link>
              ) : (
                <div key={course.id}>{card}</div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
