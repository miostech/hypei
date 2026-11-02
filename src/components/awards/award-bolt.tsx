import { cn } from "cn";

/** Colours per tier: metals for the first three, gems for the rest. */
const TIER_COLORS: Record<string, { edge: string; body: string }> = {
  BRONZE: { edge: "#b45309", body: "#d97706" },
  SILVER: { edge: "#94a3b8", body: "#cbd5e1" },
  GOLD: { edge: "#b98012", body: "#d9a52a" },
  EMERALD: { edge: "#047857", body: "#10b981" },
  DIAMOND: { edge: "#0e7490", body: "#22d3ee" },
  ONYX: { edge: "#1f2937", body: "#374151" },
};

const MUTED = { edge: "#cbd5e1", body: "#e2e8f0" };

/**
 * Silhueta do raio da marca, traçada do alpha de public/brand/kabrun-icon.png.
 *
 * Continua desenhado inline, e não com o PNG da marca, porque a cor é a informação: são seis
 * tiers mais o estado apagado, e o PNG é roxo com contorno dourado em qualquer um deles — todos
 * ficariam idênticos. O corpo e o contorno aqui imitam esse mesmo duas-cores com a cor do tier.
 */
export function AwardBolt({ tier, muted = false, className }: { tier: string | null; muted?: boolean; className?: string }) {
  const colors = muted || !tier ? MUTED : (TIER_COLORS[tier] ?? MUTED);

  return (
    // 13.6 × 32 é a proporção real do raio: num viewBox quadrado ele engorda.
    <svg viewBox="-1 -1 15.6 34" className={cn("size-6 shrink-0", className)} role="img" aria-hidden focusable="false">
      <path
        d="M12.96 0 6.21 14 13.26 14.2 0 32 7.27 17.4 0.55 17Z"
        fill={colors.body}
        stroke={colors.edge}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </svg>
  );
}
