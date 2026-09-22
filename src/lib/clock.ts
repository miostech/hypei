/** Injectable time source so settlement windows can be simulated in dev and tests. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
