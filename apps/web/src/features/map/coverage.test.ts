import { describe, expect, it } from "vitest";
import {
  mergeCoverage,
  nearbyGeometry,
  maximumMiles,
  coverageBounds,
} from "./coverage";

const coverage: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-84.41, 33.75],
            [-84.38, 33.75],
            [-84.38, 33.78],
            [-84.41, 33.78],
            [-84.41, 33.75],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-84.4, 33.77],
            [-84.37, 33.77],
            [-84.37, 33.8],
            [-84.4, 33.8],
            [-84.4, 33.77],
          ],
        ],
      },
    },
  ],
};
describe("activity coverage", () => {
  it("merges overlapping areas into one exterior boundary", () => {
    const merged = mergeCoverage(coverage);
    expect(merged.coordinates).toHaveLength(1);
    expect(coverageBounds(coverage)).toEqual([
      [-84.41, 33.75],
      [-84.37, 33.8],
    ]);
  });
  it("clips a large nearby circle to precisely the coverage", () => {
    expect(nearbyGeometry(coverage, [-84.39, 33.77], 20000)).toEqual(
      mergeCoverage(coverage),
    );
  });
  it("keeps partial circles within the coverage and returns empty outside", () => {
    const partial = nearbyGeometry(coverage, [-84.41, 33.76], 500);
    expect(partial.coordinates.flat(2).every((p) => p[0] >= -84.41)).toBe(true);
    expect(nearbyGeometry(coverage, [-85, 34], 500).coordinates).toEqual([]);
  });
  it("caps distance at the furthest useful coverage point and adjusts to center", () => {
    const limit = maximumMiles(coverage, [-84.39, 33.77]);
    expect(limit).toBeLessThan(4);
    expect(limit).toBeGreaterThan(1);
    expect(maximumMiles(coverage, [-84.5, 33.77])).toBeGreaterThan(limit);
  });
});
