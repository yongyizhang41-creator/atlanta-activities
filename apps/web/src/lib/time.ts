import { DateTime } from "luxon";
export const zone = "America/New_York";
export const day = (value: string) =>
  DateTime.fromISO(value).setZone(zone).toFormat("ccc, LLL d");
export const clock = (value: string) =>
  DateTime.fromISO(value).setZone(zone).toFormat("h:mm a");
export const fullTime = (value: string) =>
  DateTime.fromISO(value).setZone(zone).toFormat("ccc, LLL d · h:mm a ZZZZ");
export function resolveLocalTime(
  value: string,
): { iso: string; label: string }[] {
  const date = DateTime.fromISO(value, { zone });
  if (!date.isValid || date.toFormat("yyyy-MM-dd'T'HH:mm") !== value) return [];
  return date
    .getPossibleOffsets()
    .map((d) => ({ iso: d.toISO()!, label: d.toFormat("h:mm a ZZZZ (ZZ)") }));
}

/** Unknown end: expire at midnight after the activity's Eastern calendar date. */
export function planExpiry(startsAt: string, endsAt: string | null): number {
  return endsAt
    ? DateTime.fromISO(endsAt).toMillis()
    : DateTime.fromISO(startsAt)
        .setZone(zone)
        .startOf("day")
        .plus({ days: 1 })
        .toMillis();
}

export function weekLabel(start?: string, exclusiveEnd?: string): string {
  if (!start || !exclusiveEnd) return "Monday through Sunday";
  const first = DateTime.fromISO(start).setZone(zone);
  const last = DateTime.fromISO(exclusiveEnd)
    .setZone(zone)
    .minus({ seconds: 1 });
  if (!first.isValid || !last.isValid) return "Monday through Sunday";
  return `${first.toFormat("ccc, LLL d")} – ${last.toFormat("ccc, LLL d")}`;
}
