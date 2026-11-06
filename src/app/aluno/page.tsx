import { BookOpenIcon, DownloadIcon, LayoutDashboardIcon, PlayCircleIcon } from "lucide-react";
import Link from "next/link";
import { KabrunLogo } from "@/components/brand/logo";
import { CourseProgressBar } from "@/components/members/course-outline";
import { MembersHeader } from "@/components/members/members-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Metadata } from "next";
import { getMembersDictionary } from "@/lib/i18n/members";
import { langParam, requestLocale } from "@/lib/i18n/server";
import { memberCourseHref } from "@/lib/ui/routes";
import { requireUser } from "@/modules/auth/current-user";
import { getServices } from "@/server/container";

export async function generateMetadata({ searchParams }: PageProps<"/aluno">): Promise<Metadata> {
  const dict = await getMembersDictionary(await requestLocale(langParam(await searchParams)));
  return { title: dict.student.title };
}

/**
 * O painel do aluno: o que esta pessoa comprou, de todos os produtores.
 *
 * A área de membros é de um produtor por vez, e quem comprou de três tem três endereços. Esta
 * tela é a porta única — e o outro lado da chave que o produtor tem no menu dele.
 */
export default async function StudentPanelPage({ searchParams }: PageProps<"/aluno">) {
  const user = await requireUser("/aluno");
  const services = getServices();

  // Mesma regra do checkout e da área de membros: o idioma é o que o navegador de quem comprou pede.
  const dict = await getMembersDictionary(await requestLocale(langParam(await searchParams)));
  const [purchases, memberships] = await Promise.all([
    services.memberArea.listPurchases(user.email),
    services.organizations.listForUser(user.id),
  ]);

  return (
    <div lang={dict.localeTag} className="flex min-h-svh flex-col bg-muted/40">
      <MembersHeader
        title={dict.student.title}
        subtitle={user.email}
        user={user}
        dict={dict}
        meta={
          <>
            <KabrunLogo className="mr-1 hidden h-5 opacity-60 sm:block" />
            {/* Só quem vende tem para onde voltar. */}
            {memberships.length > 0 && (
              <Button variant="outline" size="sm" render={<Link href="/dashboard" />}>
                <LayoutDashboardIcon />
                <span className="hidden sm:inline">{dict.student.producerPanel}</span>
              </Button>
            )}
          </>
        }
      />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 p-4 sm:p-6">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{dict.student.title}</h1>
          <p className="text-sm text-muted-foreground">{dict.student.subtitle}</p>
        </div>

        {purchases.length === 0 ? (
          <EmptyState icon={BookOpenIcon} title={dict.student.emptyTitle} description={dict.student.emptyBody} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {purchases.map(({ course, organization, percentage, completedLessons, totalLessons }) => (
              <Link key={course.id} href={memberCourseHref(organization.slug, course.slug)} className="group">
                <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-card">
                  <CardContent className="flex h-full flex-col gap-3">
                    <span className="bg-brand-gradient flex size-10 items-center justify-center rounded-xl text-white">
                      <BookOpenIcon className="size-5" aria-hidden />
                    </span>

                    <div className="flex-1">
                      <h2 className="font-heading font-semibold">{course.title}</h2>
                      {/* Quem vendeu importa mais aqui do que na área de um produtor só. */}
                      <p className="mt-0.5 text-xs text-muted-foreground">{organization.name}</p>
                      {course.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>}
                    </div>

                    <div className="space-y-3 border-t pt-3">
                      {/* Entrega de arquivo único não tem progresso: ou você baixou, ou não. */}
                      {totalLessons > 1 && (
                        <CourseProgressBar percentage={percentage} completed={completedLessons} total={totalLessons} dict={dict} />
                      )}
                      <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                        {totalLessons === 1 ? <DownloadIcon className="size-4" aria-hidden /> : <PlayCircleIcon className="size-4" aria-hidden />}
                        {totalLessons === 1 ? dict.home.open : percentage > 0 ? dict.home.resume : dict.home.start}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
