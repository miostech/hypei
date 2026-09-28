import type { LucideIcon } from "lucide-react";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Tone = "default" | "positive" | "warning" | "muted" | "gold";

const ICON_TONE: Record<Tone, string> = {
  default: "bg-accent text-accent-foreground",
  positive: "bg-success/10 text-success",
  warning: "bg-warning/12 text-warning",
  muted: "bg-muted text-muted-foreground",
  gold: "bg-gold/15 text-warning",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  delta,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  /** Percentage change versus the previous period; sign drives the chip. */
  delta?: { value: string; direction: "up" | "down" };
  className?: string;
}) {
  const DeltaIcon = delta?.direction === "down" ? TrendingDownIcon : TrendingUpIcon;

  return (
    <Card className={cn("gap-0 py-5", className)}>
      <CardContent className="px-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">{label}</p>
          {Icon && (
            <span className={cn("flex size-8 items-center justify-center rounded-xl", ICON_TONE[tone])}>
              <Icon className="size-4" aria-hidden />
            </span>
          )}
        </div>
        <p className="tabular mt-3 font-heading text-2xl font-bold tracking-tight">{value}</p>
        <div className="mt-1.5 flex items-center gap-2">
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.7rem] font-medium",
                delta.direction === "up" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              <DeltaIcon className="size-3" aria-hidden />
              {delta.value}
            </span>
          )}
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="gap-0 py-5">
      <CardContent className="space-y-3 px-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}
