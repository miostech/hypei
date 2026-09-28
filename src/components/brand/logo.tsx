import Image from "next/image";
import { cn } from "cn";

/**
 * Official Ripay artwork (public/brand). The icon PNG is transparent, so it works on
 * any surface; the lockup's wordmark is deep purple, so dark surfaces use the knockout
 * variant instead.
 */
export function RipayMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/ripay-icon.png"
      alt=""
      width={498}
      height={512}
      priority
      className={cn("size-8 w-auto object-contain", className)}
    />
  );
}

export function RipayLogo({
  className,
  showWordmark = true,
  variant = "default",
}: {
  className?: string;
  showWordmark?: boolean;
  /** `knockout` renders the white wordmark, for the sidebar and other dark surfaces. */
  variant?: "default" | "knockout";
}) {
  if (!showWordmark) return <RipayMark className={className} />;

  if (variant === "knockout") {
    return (
      <span className={cn("flex items-center gap-2", className)}>
        <RipayMark />
        <Image src="/brand/ripay-wordmark-light.png" alt="Ripay" width={761} height={296} className="h-[1.15rem] w-auto object-contain" />
      </span>
    );
  }

  return (
    <Image
      src="/brand/ripay-logo.png"
      alt="Ripay"
      width={1140}
      height={361}
      priority
      className={cn("h-8 w-auto object-contain", className)}
    />
  );
}
