import { DateTime } from "luxon";
import type { Activity } from "../../lib/types";
import { zone } from "../../lib/time";

export type ActivityDay = { date: string; label: string; events: Activity[] };

/** Preserve the server's chronological/tie ordering, including appended pages. */
export function groupActivityDays(items: readonly Activity[]): ActivityDay[] {
  const days = new Map<string, ActivityDay>();
  for (const event of items) {
    const start = DateTime.fromISO(event.starts_at)
      .setZone(zone)
      .setLocale("en-US");
    const date = start.toISODate()!;
    let group = days.get(date);
    if (!group) {
      group = { date, label: start.toFormat("cccc, LLL d"), events: [] };
      days.set(date, group);
    }
    group.events.push(event);
  }
  return [...days.values()];
}
