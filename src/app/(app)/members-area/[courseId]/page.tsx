import {
  ArrowDownIcon,
  ArrowUpIcon,
  BookOpenIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileTextIcon,
  HeadphonesIcon,
  type LucideIcon,
  PlayCircleIcon,
  RadioIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LessonType } from "@/generated/prisma/enums";
import { NotFoundError } from "@/lib/errors";
import { type AppDictionary, getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { fill, plural } from "@/lib/i18n/locale";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { hasPermission } from "@/modules/organizations/permissions";
import { getServices } from "@/server/container";
import { deleteLesson, deleteModule, moveLesson, moveModule, setCoursePublished, updateCourseSettings } from "../actions";
import { DeleteCourseDialog, LessonDialog, ModuleDialog } from "../content-dialogs";
import { CourseForm } from "../course-form";
import { TranslationSoon } from "../translation-soon";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAppDictionary(await appLocale())).membersArea.editor.title };
}

const LESSON_ICON: Record<LessonType, LucideIcon> = {
  VIDEO: PlayCircleIcon,
  TEXT: FileTextIcon,
  PDF: FileTextIcon,
  AUDIO: HeadphonesIcon,
  LIVE: RadioIcon,
  DOWNLOAD: DownloadIcon,
};

export default async function CourseEditorPage({ params }: PageProps<"/members-area/[courseId]">) {
  const { courseId } = await params;
  const { organization, membership } = await requirePagePermission("products:read");
  const services = getServices();

  const course = await services.courses.get(organization.id, courseId).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const canEdit = hasPermission(membership.role, "products:write");
  const lessonCount = course.modules.reduce((total, module) => total + module.lessons.length, 0);
  const hasVideo = course.modules.some((module) => module.lessons.some((lesson) => lesson.type === "VIDEO"));
  const students = await services.uow.repos.courses.countEnrollments(course.id);
  const dict = await getAppDictionary(await appLocale());
  const t = dict.membersArea;

  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        title={course.title}
        description={`${plural(dict.locale, course.modules.length, t.moduleCount)} · ${plural(dict.locale, lessonCount, t.lessonCount)}`}
        actions={
          <>
            <Badge variant={course.published ? "success" : "outline"} className="h-8 px-3">
              {course.published ? t.published : t.draft}
            </Badge>
            {course.published && (
              <Button variant="outline" render={<Link href={`/members/${organization.slug}/courses/${course.slug}`} target="_blank" />}>
                <EyeIcon />
                {t.editor.viewAsStudent}
              </Button>
            )}
            {canEdit && (
              <form action={setCoursePublished}>
                <input type="hidden" name="courseId" value={course.id} />
                <input type="hidden" name="published" value={course.published ? "false" : "true"} />
                <Button
                  type="submit"
                  className={course.published ? "" : "bg-gold-gradient border-0 text-gold-foreground shadow-gold hover:opacity-90"}
                  variant={course.published ? "outline" : "default"}
                  disabled={!course.published && lessonCount === 0}
                >
                  <ExternalLinkIcon />
                  {course.published ? t.editor.unpublish : t.editor.publish}
                </Button>
              </form>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>{t.editor.contentTitle}</CardTitle>
              <CardDescription>{t.editor.contentDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {course.modules.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <BookOpenIcon className="mx-auto size-8 text-muted-foreground" aria-hidden />
                  <p className="mt-3 text-sm font-medium">{t.editor.noModulesTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t.editor.noModulesBody}</p>
                </div>
              ) : (
                course.modules.map((module, moduleIndex) => (
                  <section key={module.id} className="overflow-hidden rounded-xl border">
                    <header className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent font-heading text-xs font-bold text-accent-foreground">
                        {moduleIndex + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{module.title}</p>
                        <p className="text-xs text-muted-foreground">{plural(dict.locale, module.lessons.length, t.lessonCount)}</p>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-0.5">
                          <span className="hidden items-center gap-0.5 sm:flex">
                            <MoveButton action={moveModule} idName="moduleId" id={module.id} courseId={course.id} direction="up" disabled={moduleIndex === 0} dict={dict} />
                            <MoveButton
                              action={moveModule}
                              idName="moduleId"
                              id={module.id}
                              courseId={course.id}
                              direction="down"
                              disabled={moduleIndex === course.modules.length - 1}
                              dict={dict}
                            />
                          </span>
                          <ModuleDialog courseId={course.id} module={{ id: module.id, title: module.title }} />
                          <DeleteButton action={deleteModule} idName="moduleId" id={module.id} courseId={course.id} label={t.editor.deleteModule} />
                        </div>
                      )}
                    </header>

                    <ul className="divide-y">
                      {module.lessons.map((lesson, lessonIndex) => {
                        const Icon = LESSON_ICON[lesson.type];
                        return (
                          <li key={lesson.id} className="flex items-center gap-3 px-4 py-2.5">
                            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">{lesson.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {t.lessonTypes[lesson.type]}
                                {lesson.durationSeconds
                                  ? ` · ${fill(t.editor.minutes, { count: Math.round(lesson.durationSeconds / 60) })}`
                                  : ""}
                              </p>
                            </div>
                            {canEdit && (
                              <div className="flex items-center gap-0.5">
                                <span className="hidden items-center gap-0.5 sm:flex">
                                  <MoveButton action={moveLesson} idName="lessonId" id={lesson.id} courseId={course.id} direction="up" disabled={lessonIndex === 0} dict={dict} />
                                  <MoveButton
                                    action={moveLesson}
                                    idName="lessonId"
                                    id={lesson.id}
                                    courseId={course.id}
                                    direction="down"
                                    disabled={lessonIndex === module.lessons.length - 1}
                                    dict={dict}
                                  />
                                </span>
                                <LessonDialog
                                  courseId={course.id}
                                  moduleId={module.id}
                                  lesson={{
                                    id: lesson.id,
                                    title: lesson.title,
                                    type: lesson.type,
                                    durationSeconds: lesson.durationSeconds,
                                    externalUrl: lesson.externalUrl,
                                    content: lesson.content,
                                    storageKey: lesson.storageKey,
                                    storageFilename: lesson.storageFilename,
                                    storageType: lesson.storageType,
                                    storageBytes: lesson.storageBytes,
                                  }}
                                />
                                <DeleteButton action={deleteLesson} idName="lessonId" id={lesson.id} courseId={course.id} label={t.editor.deleteLesson} />
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {canEdit && (
                      <div className="border-t px-2 py-1.5">
                        <LessonDialog courseId={course.id} moduleId={module.id} />
                      </div>
                    )}
                  </section>
                ))
              )}

              {canEdit && <ModuleDialog courseId={course.id} />}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          {canEdit && (
            <CourseForm
              action={updateCourseSettings}
              defaultValues={{
                courseId: course.id,
                title: course.title,
                slug: course.slug,
                description: course.description ?? "",
              }}
              submitLabel={dict.common.saveChanges}
              title={t.editor.settingsTitle}
              description={t.editor.settingsDescription}
            />
          )}

          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>{t.editor.accessTitle}</CardTitle>
              <CardDescription>{t.editor.accessDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="flex items-center justify-between">
                <span className="text-muted-foreground">{dict.common.product}</span>
                <Link href={`/products/${course.productId}`} className="font-medium hover:underline">
                  {t.editor.viewProduct}
                </Link>
              </p>
              <p className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <UsersIcon className="size-4" aria-hidden /> {t.editor.students}
                </span>
                <span className="tabular font-medium">{students}</span>
              </p>
              {!course.published && lessonCount === 0 && (
                <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  {t.editor.needsLesson}
                </p>
              )}
            </CardContent>
          </Card>

          {hasVideo && <TranslationSoon dict={dict} />}

          {canEdit && (
            <Card className="border-destructive/30">
              <CardHeader className="border-b pb-4">
                <CardTitle>{t.editor.dangerTitle}</CardTitle>
                <CardDescription>{t.editor.dangerDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <DeleteCourseDialog courseId={course.id} title={course.title} students={students} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function MoveButton({
  action,
  idName,
  id,
  courseId,
  direction,
  disabled,
  dict,
}: {
  action: (formData: FormData) => Promise<void>;
  idName: "moduleId" | "lessonId";
  id: string;
  courseId: string;
  direction: "up" | "down";
  disabled: boolean;
  dict: AppDictionary;
}) {
  const Icon = direction === "up" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <form action={action}>
      <input type="hidden" name={idName} value={id} />
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="direction" value={direction} />
      <Button type="submit" variant="ghost" size="icon-sm" disabled={disabled} aria-label={direction === "up" ? dict.membersArea.editor.moveUp : dict.membersArea.editor.moveDown}>
        <Icon />
      </Button>
    </form>
  );
}

function DeleteButton({
  action,
  idName,
  id,
  courseId,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  idName: "moduleId" | "lessonId";
  id: string;
  courseId: string;
  label: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name={idName} value={id} />
      <input type="hidden" name="courseId" value={courseId} />
      <Button type="submit" variant="ghost" size="icon-sm" aria-label={label} className="text-muted-foreground hover:text-destructive">
        <Trash2Icon />
      </Button>
    </form>
  );
}
