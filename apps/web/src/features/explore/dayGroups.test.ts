import { describe, expect, it } from "vitest";
import { groupActivityDays } from "./dayGroups";
import type { Activity } from "../../lib/types";
const event = (id: string, starts_at: string) =>
  ({ id, starts_at }) as Activity;

describe("journal Eastern calendar days", () => {
  it("groups UTC midnight into its actual Atlanta day without changing source order", () => {
    const items = [
      event("a", "2026-10-24T00:30:00Z"),
      event("b", "2026-10-24T03:30:00Z"),
      event("c", "2026-10-24T04:00:00Z"),
    ];
    const groups = groupActivityDays(items);
    expect(
      groups.map((g) => [g.date, g.label, g.events.map((e) => e.id)]),
    ).toEqual([
      ["2026-10-23", "Friday, Oct 23", ["a", "b"]],
      ["2026-10-24", "Saturday, Oct 24", ["c"]],
    ]);
    expect(items.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });
  it("keeps both repeated DST hours in one day", () => {
    const groups = groupActivityDays([
      event("early", "2026-11-01T05:30:00Z"),
      event("late", "2026-11-01T06:30:00Z"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBe("2026-11-01");
    expect(groups[0].events.map((e) => e.id)).toEqual(["early", "late"]);
  });
  it("merges appended pages into one day heading and handles no results", () => {
    const first = [event("a", "2026-10-23T18:00:00Z")];
    const next = [
      event("b", "2026-10-23T20:00:00Z"),
      event("c", "2026-10-24T18:00:00Z"),
    ];
    expect(
      groupActivityDays([...first, ...next]).map((g) => g.events.length),
    ).toEqual([2, 1]);
    expect(groupActivityDays([])).toEqual([]);
  });
});
