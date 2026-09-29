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
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LessonType } from "@/generated/prisma/enums";
import { NotFoundError } from "@/lib/errors";
import { LESSON_TYPE_LABELS } from "@/modules/members/course.schemas";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { hasPermission } from "@/modules/organizations/permissions";
import { getServices } from "@/server/container";
import { deleteLesson, deleteModule, moveLesson, moveModule, setCoursePublished, updateCourseSettings } from "../actions";
import { LessonDialog, ModuleDialog } from "../content-dialogs";
import { CourseForm } from "../course-form";

export const metadata = { title: "Editar curso" };

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
  const students = await services.uow.repos.courses.countEnrollments(course.id);

  return (
    <>
      <PageHeader
        eyebrow="Área de membros"
        title={course.title}
        description={`${course.modules.length} módulo(s) · ${lessonCount} aula(s)`}
        actions={
          <>
            <Badge variant={course.published ? "success" : "outline"} className="h-8 px-3">
              {course.published ? "Publicado" : "Rascunho"}
            </Badge>
            {course.published && (
              <Button variant="outline" render={<Link href={`/members/${organization.slug}/courses/${course.slug}`} target="_blank" />}>
                <EyeIcon />
                Ver como aluno
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
                  {course.published ? "Despublicar" : "Publicar curso"}
                </Button>
              </form>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>Conteúdo</CardTitle>
              <CardDescription>Os alunos assistem na ordem em que os módulos e as aulas aparecem aqui.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {course.modules.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <BookOpenIcon className="mx-auto size-8 text-muted-foreground" aria-hidden />
                  <p className="mt-3 text-sm font-medium">Nenhum módulo ainda</p>
                  <p className="mt-1 text-sm text-muted-foreground">Comece criando o primeiro módulo do curso.</p>
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
                        <p className="text-xs text-muted-foreground">{module.lessons.length} aula(s)</p>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-0.5">
                          <MoveButton action={moveModule} idName="moduleId" id={module.id} courseId={course.id} direction="up" disabled={moduleIndex === 0} />
                          <MoveButton
                            action={moveModule}
                            idName="moduleId"
                            id={module.id}
                            courseId={course.id}
                            direction="down"
                            disabled={moduleIndex === course.modules.length - 1}
                          />
                          <ModuleDialog courseId={course.id} module={{ id: module.id, title: module.title }} />
                          <DeleteButton action={deleteModule} idName="moduleId" id={module.id} courseId={course.id} label="Excluir módulo" />
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
                                {LESSON_TYPE_LABELS[lesson.type]}
                                {lesson.durationSeconds ? ` · ${Math.round(lesson.durationSeconds / 60)} min` : ""}
                              </p>
                            </div>
                            {canEdit && (
                              <div className="flex items-center gap-0.5">
                                <MoveButton action={moveLesson} idName="lessonId" id={lesson.id} courseId={course.id} direction="up" disabled={lessonIndex === 0} />
                                <MoveButton
                                  action={moveLesson}
                                  idName="lessonId"
                                  id={lesson.id}
                                  courseId={course.id}
                                  direction="down"
                                  disabled={lessonIndex === module.lessons.length - 1}
                                />
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
                                <DeleteButton action={deleteLesson} idName="lessonId" id={lesson.id} courseId={course.id} label="Excluir aula" />
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

        <div className="space-y-4">
          {canEdit && (
            <CourseForm
              action={updateCourseSettings}
              defaultValues={{
                courseId: course.id,
                title: course.title,
                slug: course.slug,
                description: course.description ?? "",
              }}
              submitLabel="Salvar alterações"
              title="Configurações"
              description="Título, link e descrição vistos pelo aluno."
            />
          )}

          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>Acesso</CardTitle>
              <CardDescription>Quem compra o produto entra automaticamente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="flex items-center justify-between">
                <span className="text-muted-foreground">Produto</span>
                <Link href={`/products/${course.productId}`} className="font-medium hover:underline">
                  ver produto
                </Link>
              </p>
              <p className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <UsersIcon className="size-4" aria-hidden /> Alunos
                </span>
                <span className="tabular font-medium">{students}</span>
              </p>
              {!course.published && lessonCount === 0 && (
                <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  Crie pelo menos uma aula para poder publicar o curso.
                </p>
              )}
            </CardContent>
          </Card>
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
}: {
  action: (formData: FormData) => Promise<void>;
  idName: "moduleId" | "lessonId";
  id: string;
  courseId: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  const Icon = direction === "up" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <form action={action}>
      <input type="hidden" name={idName} value={id} />
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="direction" value={direction} />
      <Button type="submit" variant="ghost" size="icon-sm" disabled={disabled} aria-label={direction === "up" ? "Mover para cima" : "Mover para baixo"}>
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
