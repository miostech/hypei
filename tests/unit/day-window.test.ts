import { describe, expect, it } from "vitest";
import { startOfDayIn, timezoneForCountry, todayAgainstYesterday } from "@/lib/time/day-window";

describe("Day window", () => {
  it("maps a country to its timezone and falls back to UTC", () => {
    expect(timezoneForCountry("BR")).toBe("America/Sao_Paulo");
    expect(timezoneForCountry("pt")).toBe("Europe/Lisbon");
    expect(timezoneForCountry("ZZ")).toBe("UTC");
    expect(timezoneForCountry(null)).toBe("UTC");
  });

  it("starts the Brazilian day at 03:00 UTC", () => {
    // 2026-03-10 18:30 UTC is 15:30 in São Paulo (UTC-3).
    const start = startOfDayIn("America/Sao_Paulo", new Date("2026-03-10T18:30:00Z"));
    expect(start.toISOString()).toBe("2026-03-10T03:00:00.000Z");
  });

  it("keeps a late-night Brazilian sale on the day the producer lived it", () => {
    // 2026-03-11 01:30 UTC is still 2026-03-10, 22:30 in São Paulo.
    const lateSale = new Date("2026-03-11T01:30:00Z");
    const start = startOfDayIn("America/Sao_Paulo", lateSale);
    expect(start.toISOString()).toBe("2026-03-10T03:00:00.000Z");
    expect(lateSale >= start).toBe(true);
  });

  it("starts the UTC day at midnight UTC", () => {
    expect(startOfDayIn("UTC", new Date("2026-03-10T18:30:00Z")).toISOString()).toBe("2026-03-10T00:00:00.000Z");
  });

  it("compares today against the same stretch of yesterday", () => {
    const now = new Date("2026-03-10T13:00:00Z"); // 10:00 in São Paulo
    const window = todayAgainstYesterday("America/Sao_Paulo", now);

    expect(window.todayStart.toISOString()).toBe("2026-03-10T03:00:00.000Z");
    expect(window.yesterdayStart.toISOString()).toBe("2026-03-09T03:00:00.000Z");
    // Ten hours into the day on both sides.
    expect(window.yesterdayEnd.getTime() - window.yesterdayStart.getTime()).toBe(now.getTime() - window.todayStart.getTime());
    expect(window.yesterdayEnd.toISOString()).toBe("2026-03-09T13:00:00.000Z");
  });

  it("holds across a daylight saving change in Lisbon", () => {
    // Portugal moves to summer time on 2026-03-29 at 01:00 UTC.
    const beforeChange = startOfDayIn("Europe/Lisbon", new Date("2026-03-28T12:00:00Z"));
    const afterChange = startOfDayIn("Europe/Lisbon", new Date("2026-03-30T12:00:00Z"));
    expect(beforeChange.toISOString()).toBe("2026-03-28T00:00:00.000Z");
    // After the change local midnight is 23:00 UTC of the previous day.
    expect(afterChange.toISOString()).toBe("2026-03-29T23:00:00.000Z");
  });
});
