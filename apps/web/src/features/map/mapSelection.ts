import type { MapPoints } from "@/lib/types";

export type MapActivity = MapPoints["features"][number]["properties"];

export function uniqueActivities(
  features: { properties: unknown }[],
): MapActivity[] {
  const activities = new Map<string, MapActivity>();
  for (const { properties } of features) {
    if (!properties || typeof properties !== "object") continue;
    const value = properties as Record<string, unknown>;
    if (typeof value.id !== "string" || typeof value.title !== "string")
      continue;
    activities.set(value.id, {
      id: value.id,
      title: value.title,
      category: typeof value.category === "string" ? value.category : "",
    });
  }
  return [...activities.values()];
}
