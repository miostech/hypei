/**
 * "Today" has to mean the producer's today, not the server's.
 *
 * A sale at 22h in São Paulo happens on the next UTC day; counting it as tomorrow
 * would make the dashboard disagree with what the producer just saw happen. There
 * is no timezone on the organization yet, so it is derived from its country.
 */
const TIMEZONE_BY_COUNTRY: Record<string, string> = {
  BR: "America/Sao_Paulo",
  PT: "Europe/Lisbon",
  ES: "Europe/Madrid",
  FR: "Europe/Paris",
  DE: "Europe/Berlin",
  IT: "Europe/Rome",
  US: "America/New_York",
  MX: "America/Mexico_City",
  AR: "America/Argentina/Buenos_Aires",
  CL: "America/Santiago",
  CO: "America/Bogota",
};

/** Countries with several zones use their most populated one; UTC is the fallback. */
export function timezoneForCountry(country: string | null | undefined): string {
  return TIMEZONE_BY_COUNTRY[(country ?? "").toUpperCase()] ?? "UTC";
}

/** How far the zone is from UTC at that instant, daylight saving included. */
function offsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asIfUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour") % 24, value("minute"), value("second"));
  return asIfUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant the current day started in that timezone. */
export function startOfDayIn(timeZone: string, now = new Date()): Date {
  const offset = offsetMs(timeZone, now);
  const local = new Date(now.getTime() + offset);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnight - offset);
}

export interface DayComparison {
  todayStart: Date;
  now: Date;
  /** Same stretch of yesterday, so a morning is compared against a morning. */
  yesterdayStart: Date;
  yesterdayEnd: Date;
}

export function todayAgainstYesterday(timeZone: string, now = new Date()): DayComparison {
  const todayStart = startOfDayIn(timeZone, now);
  const yesterdayStart = startOfDayIn(timeZone, new Date(todayStart.getTime() - 12 * 3_600_000));
  const elapsed = now.getTime() - todayStart.getTime();
  return {
    todayStart,
    now,
    yesterdayStart,
    yesterdayEnd: new Date(yesterdayStart.getTime() + elapsed),
  };
}
