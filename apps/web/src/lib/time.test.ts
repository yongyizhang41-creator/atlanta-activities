import { describe, it, expect } from "vitest";
import { resolveLocalTime, fullTime, planExpiry, weekLabel } from "./time";
describe("New York reminder time", () => {
  it("rejects nonexistent spring time", () =>
    expect(resolveLocalTime("2026-03-08T02:30")).toEqual([]));
  it("requires a choice for repeated fall time", () =>
    expect(resolveLocalTime("2026-11-01T01:30")).toHaveLength(2));
  it("formats in Eastern regardless of browser timezone", () =>
    expect(fullTime("2026-10-22T20:00:00Z")).toContain("4:00 PM"));
});

describe("plan expiry at Eastern midnight", () => {
  it("uses the activity's local date instead of its UTC date", () => {
    expect(
      new Date(planExpiry("2026-10-24T02:00:00Z", null)).toISOString(),
    ).toBe("2026-10-24T04:00:00.000Z");
  });
  it("uses calendar midnight across DST rather than adding 24 hours", () => {
    expect(
      new Date(planExpiry("2026-11-01T05:30:00Z", null)).toISOString(),
    ).toBe("2026-11-02T05:00:00.000Z");
    expect(
      new Date(planExpiry("2027-03-14T06:30:00Z", null)).toISOString(),
    ).toBe("2027-03-15T04:00:00.000Z");
  });
  it("keeps explicit overnight end times", () => {
    const end = "2026-10-24T07:00:00Z";
    expect(planExpiry("2026-10-24T02:00:00Z", end)).toBe(Date.parse(end));
  });
});

describe("week label", () => {
  it("formats exclusive week ends in Eastern time", () => {
    expect(weekLabel("2026-10-26T04:00:00Z", "2026-11-02T05:00:00Z")).toBe(
      "Mon, Oct 26 – Sun, Nov 1",
    );
  });
  it("keeps the explorer renderable if week metadata is temporarily unavailable", () => {
    expect(weekLabel(undefined, undefined)).toBe("Monday through Sunday");
    expect(weekLabel("invalid", "invalid")).toBe("Monday through Sunday");
  });
});
