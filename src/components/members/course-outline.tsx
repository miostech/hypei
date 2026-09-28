import { CheckIcon, DownloadIcon, FileTextIcon, HeadphonesIcon, type LucideIcon, PlayCircleIcon, RadioIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { cn } from "cn";
import type { LessonType } from "@/generated/prisma/enums";
import type { CourseOutline } from "@/modules/members/member-area.service";

export const LESSON_ICON: Record<LessonType, LucideIcon> = {
  VIDEO: PlayCircleIcon,
  TEXT: FileTextIcon,
  PDF: FileTextIcon,
  AUDIO: HeadphonesIcon,
  LIVE: RadioIcon,
  DOWNLOAD: DownloadIcon,
};

export function CourseOutlineList({
  outline,
  lessonHref,
  currentLessonId,
  compact = false,
}: {
  outline: CourseOutline;
  lessonHref: (lessonId: string) => Route;
  currentLessonId?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {outline.modules.map((module, moduleIndex) => (
        <section key={module.id} className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <header className="flex items-center gap-2.5 border-b px-4 py-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-accent font-heading text-[0.65rem] font-bold text-accent-foreground">
              {moduleIndex + 1}
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{module.title}</p>
            <span className="shrink-0 text-xs text-muted-foreground">
              {module.lessons.filter((lesson) => lesson.completed).length}/{module.lessons.length}
            </span>
          </header>

          <ul>
            {module.lessons.map((lesson) => {
              const Icon = LESSON_ICON[lesson.type];
              const isCurrent = lesson.id === currentLessonId;
              return (
                <li key={lesson.id}>
                  <Link
                    href={lessonHref(lesson.id)}
                    aria-current={isCurrent ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 border-b px-4 py-2.5 text-sm transition-colors last:border-b-0",
                      isCurrent ? "bg-accent/60 font-medium" : "hover:bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full",
                        lesson.completed ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {lesson.completed ? <CheckIcon className="size-3.5" /> : <Icon className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                    {lesson.durationSeconds ? (
                      <span className="tabular shrink-0 text-xs text-muted-foreground">{Math.round(lesson.durationSeconds / 60)} min</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function CourseProgressBar({ percentage, completed, total }: { percentage: number; completed: number; total: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {completed} de {total} aulas concluídas
        </span>
        <span className="tabular font-medium">{percentage}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-brand-gradient h-full rounded-full transition-all" style={{ width: `${Math.max(percentage, 2)}%` }} />
      </div>
    </div>
  );
}
