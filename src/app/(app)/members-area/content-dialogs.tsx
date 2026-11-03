"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { TextField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LessonType } from "@/generated/prisma/enums";
import { idleState, type ActionState } from "@/lib/actions/action-state";
import { useAppDictionary } from "@/lib/i18n/app/provider";
import { fill, plural } from "@/lib/i18n/locale";
import { addLesson, addModule, deleteCourse, renameModule, updateLesson } from "./actions";
import { LessonFileField, type UploadedFile } from "./lesson-file-field";

/** Dialog that closes itself once the action succeeds, without syncing state in an effect. */
function useDialogAction(action: (prev: ActionState, formData: FormData) => Promise<ActionState>) {
  const fallback = useAppDictionary().toasts.saved;
  const [opened, setOpened] = useState(false);
  const [state, formAction] = useActionState(action, idleState);
  const open = opened && state.status !== "success";

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? fallback);
  }, [state, fallback]);

  return { open, setOpened, state, formAction };
}

export function ModuleDialog({ courseId, module }: { courseId: string; module?: { id: string; title: string } }) {
  const dict = useAppDictionary();
  const t = dict.membersArea.moduleDialog;
  const { open, setOpened, state, formAction } = useDialogAction(module ? renameModule : addModule);
  const error = state.status === "error" ? (state.fieldErrors?.title ?? state.message) : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpened}>
      <DialogTrigger
        render={
          module ? (
            <Button variant="ghost" size="icon-sm" aria-label={t.rename}>
              <PencilIcon />
            </Button>
          ) : (
            <Button variant="outline">
              <PlusIcon />
              {t.add}
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{module ? t.rename : t.new}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="courseId" value={courseId} />
          {module && <input type="hidden" name="moduleId" value={module.id} />}
          <TextField label={t.fieldTitle} name="title" defaultValue={module?.title} required autoFocus error={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpened(false)}>
              {dict.common.cancel}
            </Button>
            <SubmitButton>{module ? dict.common.save : t.create}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface LessonValues {
  id: string;
  title: string;
  type: keyof typeof LessonType;
  durationSeconds: number | null;
  externalUrl: string | null;
  content: string | null;
  storageKey: string | null;
  storageFilename: string | null;
  storageType: string | null;
  storageBytes: number | null;
}

export function LessonDialog({ courseId, moduleId, lesson }: { courseId: string; moduleId: string; lesson?: LessonValues }) {
  const dict = useAppDictionary();
  const t = dict.membersArea.lessonDialog;
  const { open, setOpened, state, formAction } = useDialogAction(lesson ? updateLesson : addLesson);
  const [type, setType] = useState<keyof typeof LessonType>(lesson?.type ?? "VIDEO");
  const [file, setFile] = useState<UploadedFile | null>(
    lesson?.storageKey
      ? {
          key: lesson.storageKey,
          filename: lesson.storageFilename ?? dict.membersArea.file.fallbackName,
          contentType: lesson.storageType ?? "application/octet-stream",
          bytes: lesson.storageBytes ?? 0,
        }
      : null,
  );
  // One dialog per lesson lives in the DOM, so the field ids must be unique.
  const fieldId = useId();
  const fieldError = (field: string) => (state.status === "error" ? state.fieldErrors?.[field] : undefined);

  return (
    <Dialog open={open} onOpenChange={setOpened}>
      <DialogTrigger
        render={
          lesson ? (
            <Button variant="ghost" size="icon-sm" aria-label={t.edit}>
              <PencilIcon />
            </Button>
          ) : (
            <Button variant="ghost" size="sm">
              <PlusIcon />
              {t.add}
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{lesson ? t.edit : t.new}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="moduleId" value={moduleId} />
          {lesson && <input type="hidden" name="lessonId" value={lesson.id} />}

          <TextField label={t.fieldTitle} name="title" defaultValue={lesson?.title} required autoFocus error={fieldError("title")} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`type-${fieldId}`}>{dict.common.type}</Label>
              <select
                id={`type-${fieldId}`}
                name="type"
                value={type}
                onChange={(event) => setType(event.target.value as keyof typeof LessonType)}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {Object.values(LessonType).map((value) => (
                  <option key={value} value={value}>
                    {dict.membersArea.lessonTypes[value]}
                  </option>
                ))}
              </select>
            </div>
            <TextField
              label={t.duration}
              name="durationMinutes"
              type="number"
              min={0}
              max={1440}
              defaultValue={lesson?.durationSeconds ? Math.round(lesson.durationSeconds / 60) : ""}
              error={fieldError("durationMinutes")}
            />
          </div>

          {type === "TEXT" ? (
            <div className="space-y-1.5">
              <Label htmlFor={`content-${fieldId}`}>{t.content}</Label>
              <Textarea id={`content-${fieldId}`} name="content" rows={7} defaultValue={lesson?.content ?? ""} maxLength={20_000} />
              {fieldError("content") && <p className="text-xs text-destructive">{fieldError("content")}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <LessonFileField moduleId={moduleId} type={type} value={file} onChange={setFile} fieldId={fieldId} />

              {!file && (
                <>
                  <p className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    {t.orLink}
                    <span className="h-px flex-1 bg-border" />
                  </p>
                  <TextField
                    label={t.externalUrl}
                    name="externalUrl"
                    type="url"
                    placeholder="https://…"
                    defaultValue={lesson?.externalUrl ?? ""}
                    hint={t.externalUrlHint}
                    error={fieldError("externalUrl")}
                  />
                </>
              )}
            </div>
          )}

          {state.status === "error" && !state.fieldErrors && <p className="text-xs text-destructive">{state.message}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpened(false)}>
              {dict.common.cancel}
            </Button>
            <SubmitButton>{lesson ? t.save : t.add}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Apagar conteúdo é o único destrutivo que não tem volta nem histórico — módulos, aulas e
 * arquivos enviados somem junto —, então é o único que pergunta antes.
 */
export function DeleteCourseDialog({ courseId, title, students }: { courseId: string; title: string; students: number }) {
  const dict = useAppDictionary();
  const t = dict.membersArea.deleteCourse;
  const [opened, setOpened] = useState(false);

  if (students > 0) {
    return <p className="text-xs text-muted-foreground">{plural(dict.locale, students, t.blocked)}</p>;
  }

  return (
    <Dialog open={opened} onOpenChange={setOpened}>
      <DialogTrigger
        render={
          <Button variant="outline" className="w-full text-destructive hover:text-destructive">
            <Trash2Icon />
            {t.trigger}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fill(t.title, { title })}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <form action={deleteCourse}>
          <input type="hidden" name="courseId" value={courseId} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpened(false)}>
              {dict.common.cancel}
            </Button>
            <SubmitButton variant="destructive" pendingLabel={t.pending}>
              {t.confirm}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
