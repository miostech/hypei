import { BookOpenIcon, DownloadIcon, LockIcon, PlayCircleIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KabrunLogo } from "@/components/brand/logo";
import { CourseProgressBar } from "@/components/members/course-outline";
import { MembersHeader } from "@/components/members/members-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Metadata } from "next";
import { getMembersDictionary } from "@/lib/i18n/members";
import { langParam, requestLocale } from "@/lib/i18n/server";
import { memberCourseHref } from "@/lib/ui/routes";
import { requireUser } from "@/modules/auth/current-user";
import { getServices } from "@/server/container";

export async function generateMetadata({ searchParams }: PageProps<"/members/[organizationSlug]">): Promise<Metadata> {
  const dict = await getMembersDictionary(await requestLocale(langParam(await searchParams)));
  return { title: dict.area };
}

export default async function MembersHomePage({ params, searchParams }: PageProps<"/members/[organizationSlug]">) {
  const { organizationSlug } = await params;
  const user = await requireUser(`/members/${organizationSlug}`);
  const services = getServices();

  // Mesma regra do checkout: o idioma é o que o navegador de quem comprou pede.
  const dict = await getMembersDictionary(await requestLocale(langParam(await searchParams)));

  const organization = await services.uow.repos.organizations.findBySlug(organizationSlug);
  if (!organization) notFound();

  const courses = await services.memberArea.listForStudent(organization.id, user);

  return (
    <div lang={dict.localeTag} className="flex min-h-svh flex-col bg-muted/40">
      <MembersHeader
        title={organization.name}
        subtitle={dict.area}
        user={user}
        dict={dict}
        meta={<KabrunLogo className="mr-1 hidden h-5 opacity-60 sm:block" />}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 p-4 sm:p-6">
        <div>
          {/* Nem todo conteúdo é curso: um ebook também aparece aqui. */}
          <h1 className="font-heading text-2xl font-bold tracking-tight">{dict.home.title}</h1>
          <p className="text-sm text-muted-foreground">{dict.home.subtitle}</p>
        </div>

        {courses.length === 0 ? (
          <EmptyState icon={BookOpenIcon} title={dict.home.emptyTitle} description={dict.home.emptyBody} />
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
                      {!unlocked && <LockIcon className="size-4 text-muted-foreground" aria-label={dict.home.locked} />}
                      {preview && <Badge variant="outline">{dict.home.preview}</Badge>}
                    </div>

                    <div className="flex-1">
                      <h2 className="font-heading font-semibold">{course.title}</h2>
                      {course.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>}
                    </div>

                    {unlocked ? (
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
                    ) : (
                      <p className="border-t pt-3 text-xs text-muted-foreground">{dict.home.lockedHint}</p>
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
