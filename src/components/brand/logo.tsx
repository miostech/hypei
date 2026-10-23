import Image from "next/image";
import { cn } from "cn";

/**
 * Official Kabrun artwork (public/brand). The bolt PNG is transparent, so it works on
 * any surface; the lockup's wordmark is deep purple, so dark surfaces use the knockout
 * variant instead.
 */
export function KabrunMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/kabrun-icon.png"
      alt=""
      width={267}
      height={512}
      preload
      className={cn("size-8 w-auto object-contain", className)}
    />
  );
}

export function KabrunLogo({
  className,
  showWordmark = true,
  showMark = true,
  variant = "default",
}: {
  className?: string;
  showWordmark?: boolean;
  /** `false` drops the bolt and renders the wordmark on its own. */
  showMark?: boolean;
  /** `knockout` renders the white wordmark, for the sidebar and other dark surfaces. */
  variant?: "default" | "knockout";
}) {
  if (!showWordmark) return <KabrunMark className={className} />;

  if (!showMark) {
    return (
      <Image
        src={variant === "knockout" ? "/brand/kabrun-wordmark-light.png" : "/brand/kabrun-wordmark.png"}
        alt="Kabrun"
        width={1150}
        height={296}
        preload
        className={cn("h-8 w-auto object-contain", className)}
      />
    );
  }

  if (variant === "knockout") {
    return (
      <span className={cn("flex items-center gap-2", className)}>
        <KabrunMark />
        <Image src="/brand/kabrun-wordmark-light.png" alt="Kabrun" width={1150} height={296} className="h-[1.15rem] w-auto object-contain" />
      </span>
    );
  }

  return (
    <Image
      src="/brand/kabrun-logo.png"
      alt="Kabrun"
      width={1077}
      height={334}
      preload
      className={cn("h-8 w-auto object-contain", className)}
    />
  );
}
