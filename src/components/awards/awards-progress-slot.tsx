import { formatCompactAmount, formatDate } from "@/lib/ui/format";
import { getServices } from "@/server/container";
import { AwardsProgress, type AwardRow } from "./awards-progress";

/**
 * Server side of the topbar award widget: reads the progress and hands the client
 * component plain strings, so no money or dates cross the boundary as bigints.
 */
export async function AwardsProgressSlot({ organizationId }: { organizationId: string }) {
  const progress = await getServices().awards.progress(organizationId);

  const rows: AwardRow[] = progress.awards.map((entry) => ({
    tier: entry.tier,
    label: entry.label,
    shortLabel: formatCompactAmount(entry.threshold, progress.currency),
    earned: entry.award !== null,
    achievedAt: entry.award ? formatDate(entry.award.achievedAt) : null,
    status: entry.award?.status ?? null,
    trackingCode: entry.award?.trackingCode ?? null,
  }));

  return (
    <AwardsProgress
      currentLabel={formatCompactAmount(progress.netRevenue, progress.currency)}
      nextLabel={progress.next ? formatCompactAmount(progress.next.threshold, progress.currency) : null}
      percentage={progress.percentage}
      nextTier={progress.next?.tier ?? "ONYX"}
      rows={rows}
    />
  );
}
