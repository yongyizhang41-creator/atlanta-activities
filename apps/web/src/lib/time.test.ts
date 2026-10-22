import { describe, it, expect } from "vitest";
import { resolveLocalTime, fullTime } from "./time";
describe("New York reminder time", () => {
  it("rejects nonexistent spring time", () =>
    expect(resolveLocalTime("2026-03-08T02:30")).toEqual([]));
  it("requires a choice for repeated fall time", () =>
    expect(resolveLocalTime("2026-11-01T01:30")).toHaveLength(2));
  it("formats in Eastern regardless of browser timezone", () =>
    expect(fullTime("2026-10-22T20:00:00Z")).toContain("4:00 PM"));
});
