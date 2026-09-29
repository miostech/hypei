import { cn } from "cn";

/** Colours per tier: metals for the first three, gems for the rest. */
const TIER_COLORS: Record<string, { ring: string; body: string; shine: string }> = {
  BRONZE: { ring: "#b45309", body: "#d97706", shine: "#fbbf24" },
  SILVER: { ring: "#94a3b8", body: "#cbd5e1", shine: "#f1f5f9" },
  GOLD: { ring: "#b98012", body: "#d9a52a", shine: "#f2c75c" },
  EMERALD: { ring: "#047857", body: "#10b981", shine: "#6ee7b7" },
  DIAMOND: { ring: "#0e7490", body: "#22d3ee", shine: "#a5f3fc" },
  ONYX: { ring: "#1f2937", body: "#374151", shine: "#6b7280" },
};

const MUTED = { ring: "#cbd5e1", body: "#e2e8f0", shine: "#f8fafc" };

/**
 * Drawn inline instead of shipped as an image: six tiers in two states would be
 * twelve files to keep in step with the palette.
 */
export function AwardMedal({ tier, muted = false, className }: { tier: string | null; muted?: boolean; className?: string }) {
  const colors = muted || !tier ? MUTED : (TIER_COLORS[tier] ?? MUTED);

  return (
    <svg viewBox="0 0 32 32" className={cn("size-6 shrink-0", className)} role="img" aria-hidden focusable="false">
      {/* Ribbon */}
      <path d="M10 2h4l2 8-4 3-4-8z" fill="#dc2626" />
      <path d="M22 2h-4l-2 8 4 3 4-8z" fill="#ef4444" />
      {/* Medal */}
      <circle cx="16" cy="21" r="9" fill={colors.ring} />
      <circle cx="16" cy="21" r="7" fill={colors.body} />
      <circle cx="13.5" cy="18.5" r="2.5" fill={colors.shine} opacity="0.55" />
    </svg>
  );
}
