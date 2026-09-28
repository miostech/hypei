import { PlayCircleIcon } from "lucide-react";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { CourseOutlineList } from "@/components/members/course-outline";
import { MembersHeader } from "@/components/members/members-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotFoundError } from "@/lib/errors";
import { memberHomeHref, memberLessonHref } from "@/lib/ui/routes";
import { requireUser } from "@/modules/auth/current-user";
import { getServices } from "@/server/container";

export const metadata = { title: "Curso" };

export default async function CoursePage({ params }: PageProps<"/members/[organizationSlug]/courses/[courseSlug]">) {
  const { organizationSlug, courseSlug } = await params;
  const user = await requireUser(`/members/${organizationSlug}/courses/${courseSlug}`);
  const services = getServices();

  const organization = await services.uow.repos.organizations.findBySlug(organizationSlug);
  if (!organization) notFound();

  const course = await services.memberArea.getCourse(organization.id, courseSlug).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const access = await services.memberArea.resolveAccess(course.id, user, organization.id);
  if (!access) forbidden();

  const outline = await services.memberArea.outline(organization.id, courseSlug, access);
  const started = outline.completedLessons > 0;

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <MembersHeader
        title={course.title}
        subtitle={`${outline.modules.length} módulo(s) · ${outline.totalLessons} aula(s)`}
        backHref={memberHomeHref(organizationSlug)}
        user={user}
        meta={access.kind === "preview" ? <Badge variant="outline">Prévia da equipe</Badge> : undefined}
      />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 sm:p-6">
        <section className="bg-brand-gradient relative isolate overflow-hidden rounded-2xl p-6 text-white shadow-lift sm:p-8">
          <span aria-hidden className="bg-dot-grid pointer-events-none absolute inset-0 text-white/15 opacity-40" />
          <div className="relative space-y-5">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-balance">{course.title}</h1>
              {course.description && <p className="mt-2 max-w-2xl text-pretty text-white/75">{course.description}</p>}
            </div>

            {access.kind === "enrolled" && (
              <div className="max-w-md space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-white/75">
                    <span>
                      {outline.completedLessons} de {outline.totalLessons} aulas concluídas
                    </span>
                    <span className="tabular font-medium text-white">{outline.percentage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/20">
                    <div className="bg-gold-gradient h-full rounded-full transition-all" style={{ width: `${Math.max(outline.percentage, 2)}%` }} />
                  </div>
                </div>
              </div>
            )}

            {outline.resumeLessonId && (
              <Button
                className="bg-gold-gradient border-0 text-gold-foreground shadow-gold hover:opacity-90"
                render={<Link href={memberLessonHref(organizationSlug, courseSlug, outline.resumeLessonId)} />}
              >
                <PlayCircleIcon />
                {started ? "Continuar de onde parei" : "Começar o curso"}
              </Button>
            )}
          </div>
        </section>

        {outline.totalLessons === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
            O conteúdo deste curso ainda está sendo publicado.
          </p>
        ) : (
          <CourseOutlineList outline={outline} lessonHref={(id) => memberLessonHref(organizationSlug, courseSlug, id)} />
        )}
      </main>
    </div>
  );
}
