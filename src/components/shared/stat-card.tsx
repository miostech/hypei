import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "positive" | "warning" | "muted";
}) {
  const toneClass = {
    default: "text-foreground",
    positive: "text-success",
    warning: "text-warning",
    muted: "text-muted-foreground",
  }[tone];

  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
          {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
        </div>
        <p className={cn("tabular mt-2 text-2xl font-semibold tracking-tight", toneClass)}>{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-2 px-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}
