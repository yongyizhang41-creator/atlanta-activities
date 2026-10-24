import { expect, it } from "vitest";
import { uniqueActivities } from "./mapSelection";

it("keeps every activity at the same venue while removing duplicate rendered features", () => {
  const features = ["a", "b", "c", "d", "a"].map((id) => ({
    properties: { id, title: `Activity ${id}`, category: "Music" },
  }));
  expect(uniqueActivities(features).map((activity) => activity.id)).toEqual([
    "a",
    "b",
    "c",
    "d",
  ]);
});
