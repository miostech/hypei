import { ArrowLeftIcon, FileTextIcon, HeadphonesIcon, PlayCircleIcon, RadioIcon, type LucideIcon, DownloadIcon } from "lucide-react";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LessonType } from "@/generated/prisma/enums";
import { requireUser } from "@/modules/auth/current-user";
import { getServices } from "@/server/container";

export const metadata = { title: "Curso" };

const LESSON_ICON: Record<LessonType, LucideIcon> = {
  VIDEO: PlayCircleIcon,
  TEXT: FileTextIcon,
  PDF: FileTextIcon,
  AUDIO: HeadphonesIcon,
  LIVE: RadioIcon,
  DOWNLOAD: DownloadIcon,
};

export default async function CoursePage({ params }: PageProps<"/members/[organizationSlug]/courses/[courseSlug]">) {
  const { organizationSlug, courseSlug } = await params;
  const user = await requireUser(`/members/${organizationSlug}/courses/${courseSlug}`);
  const services = getServices();

  const organization = await services.uow.repos.organizations.findBySlug(organizationSlug);
  if (!organization) notFound();
  const course = await services.uow.repos.courses.findBySlug(organization.id, courseSlug);
  if (!course || !course.published) notFound();

  // Access requires an active enrollment (granted when the payment is confirmed) or membership.
  const [enrolled, membership] = await Promise.all([
    services.uow.repos.courses.hasEnrollment(course.id, user.email),
    services.uow.repos.organizations.findMembership(organization.id, user.id),
  ]);
  if (!enrolled && !membership) forbidden();

  const lessonCount = course.modules.reduce((total, module) => total + module.lessons.length, 0);

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center gap-3 px-4">
          <Button variant="ghost" size="icon-sm" aria-label="Voltar" render={<Link href={`/members/${organizationSlug}`} />}>
            <ArrowLeftIcon />
          </Button>
          <div>
            <p className="font-semibold">{course.title}</p>
            <p className="text-xs text-muted-foreground">
              {course.modules.length} módulo(s) · {lessonCount} aula(s)
            </p>
          </div>
          {membership && !enrolled && (
            <Badge variant="outline" className="ml-auto">
              Prévia da equipe
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 p-4 sm:p-6">
        {course.description && <p className="text-pretty text-muted-foreground">{course.description}</p>}
        {course.modules.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            O conteúdo deste curso ainda está sendo publicado.
          </p>
        ) : (
          course.modules.map((module) => (
            <Card key={module.id}>
              <CardHeader>
                <CardTitle className="text-base">{module.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {module.lessons.map((lesson) => {
                  const Icon = LESSON_ICON[lesson.type];
                  return (
                    <div key={lesson.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="flex-1">{lesson.title}</span>
                      {lesson.durationSeconds && (
                        <span className="tabular text-xs text-muted-foreground">{Math.round(lesson.durationSeconds / 60)} min</span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
