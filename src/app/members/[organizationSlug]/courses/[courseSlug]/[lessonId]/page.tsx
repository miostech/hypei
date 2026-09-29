import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ListIcon, RotateCcwIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { forbidden, notFound } from "next/navigation";
import { CourseOutlineList, LESSON_ICON } from "@/components/members/course-outline";
import { MembersHeader } from "@/components/members/members-header";
import { LessonMedia } from "@/components/members/lesson-media";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotFoundError } from "@/lib/errors";
import { memberCourseHref, memberLessonHref } from "@/lib/ui/routes";
import { requireUser } from "@/modules/auth/current-user";
import { LESSON_TYPE_LABELS } from "@/modules/members/course.schemas";
import { getServices } from "@/server/container";
import { setLessonCompleted } from "../../../actions";

export const metadata = { title: "Aula" };

export default async function LessonPage({ params }: PageProps<"/members/[organizationSlug]/courses/[courseSlug]/[lessonId]">) {
  const { organizationSlug, courseSlug, lessonId } = await params;
  const user = await requireUser(`/members/${organizationSlug}/courses/${courseSlug}/${lessonId}`);
  const services = getServices();

  const organization = await services.uow.repos.organizations.findBySlug(organizationSlug);
  if (!organization) notFound();

  const course = await services.memberArea.getCourse(organization.id, courseSlug).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const access = await services.memberArea.resolveAccess(course.id, user, organization.id);
  if (!access) forbidden();

  const view = await services.memberArea.openLesson(organization.id, courseSlug, lessonId, access).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const outline = await services.memberArea.outline(organization.id, courseSlug, access);

  const { lesson } = view;
  const Icon = LESSON_ICON[lesson.type];
  // Uploaded media is never public: each view signs a URL that expires.
  const mediaUrl = (await services.courses.lessonMediaUrl(lesson)) ?? lesson.externalUrl;

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <MembersHeader
        sticky
        title={course.title}
        subtitle={view.moduleTitle}
        backHref={memberCourseHref(organizationSlug, courseSlug)}
        user={user}
        meta={
          access.kind === "enrolled" ? (
            <span className="tabular hidden text-xs text-muted-foreground sm:block">
              {outline.completedLessons}/{outline.totalLessons} concluídas
            </span>
          ) : (
            <Badge variant="outline">Prévia da equipe</Badge>
          )
        }
      />

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-5">
          <LessonMedia type={lesson.type} externalUrl={mediaUrl} content={lesson.content} mediaType={lesson.storageType} />

          <div className="space-y-2">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="size-4" aria-hidden />
              {LESSON_TYPE_LABELS[lesson.type]}
              {lesson.durationSeconds ? ` · ${Math.round(lesson.durationSeconds / 60)} min` : ""}
            </p>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-balance">{lesson.title}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-5">
            <LessonNavButton
              variant="outline"
              href={view.previousLessonId ? memberLessonHref(organizationSlug, courseSlug, view.previousLessonId) : null}
            >
              <ArrowLeftIcon />
              Anterior
            </LessonNavButton>

            {access.kind === "enrolled" && (
              <form action={setLessonCompleted}>
                <input type="hidden" name="organizationSlug" value={organizationSlug} />
                <input type="hidden" name="courseSlug" value={courseSlug} />
                <input type="hidden" name="lessonId" value={lesson.id} />
                <input type="hidden" name="completed" value={view.completed ? "false" : "true"} />
                {!view.completed && view.nextLessonId && <input type="hidden" name="nextLessonId" value={view.nextLessonId} />}
                <Button
                  type="submit"
                  variant={view.completed ? "outline" : "default"}
                  className={view.completed ? "" : "bg-gold-gradient border-0 text-gold-foreground shadow-gold hover:opacity-90"}
                >
                  {view.completed ? <RotateCcwIcon /> : <CheckIcon />}
                  {view.completed ? "Marcar como não concluída" : "Concluir e avançar"}
                </Button>
              </form>
            )}

            <LessonNavButton
              variant="ghost"
              className="ml-auto"
              href={view.nextLessonId ? memberLessonHref(organizationSlug, courseSlug, view.nextLessonId) : null}
            >
              Próxima
              <ArrowRightIcon />
            </LessonNavButton>
          </div>
        </section>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:h-fit">
          <p className="flex items-center gap-2 px-1 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            <ListIcon className="size-3.5" aria-hidden />
            Conteúdo do curso
          </p>
          <div className="lg:max-h-[calc(100svh-12rem)] lg:overflow-y-auto lg:pr-1 scrollbar-slim">
            <CourseOutlineList
              outline={outline}
              lessonHref={(id) => memberLessonHref(organizationSlug, courseSlug, id)}
              currentLessonId={lesson.id}
              compact
            />
          </div>
        </aside>
      </main>
    </div>
  );
}

/**
 * Previous/next navigation. With a target it renders a link; without one it stays a
 * plain disabled button — passing a native <button> through `render` makes Base UI
 * treat it as a custom element and strip the behaviour it already has.
 */
function LessonNavButton({
  href,
  variant,
  className,
  children,
}: {
  href: Route | null;
  variant: "outline" | "ghost";
  className?: string;
  children: ReactNode;
}) {
  if (!href) {
    return (
      <Button variant={variant} className={className} disabled>
        {children}
      </Button>
    );
  }
  return (
    <Button variant={variant} className={className} render={<Link href={href} />}>
      {children}
    </Button>
  );
}
