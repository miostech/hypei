import { cn } from "cn";

/** Hypei mark: an ascending "H" — two columns bridged by a rising bar. */
export function HypeiMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label="Hypei" className={cn("size-7", className)}>
      <defs>
        <linearGradient id="hypei-mark" x1="0" y1="32" x2="32" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.75" />
          <stop offset="1" stopColor="currentColor" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#hypei-mark)" />
      <path d="M11 9v14M21 9v14" stroke="var(--primary-foreground)" strokeWidth="3" strokeLinecap="round" />
      <path d="M10 19.5 22 12.5" stroke="var(--primary-foreground)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function HypeiLogo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2 text-primary", className)}>
      <HypeiMark />
      {showWordmark && <span className="text-[1.05rem] font-semibold tracking-tight text-foreground">Hypei</span>}
    </span>
  );
}
