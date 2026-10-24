import clipping, { type MultiPolygon, type Polygon } from "polygon-clipping";
const { union, intersection } = clipping;

export function mergeCoverage(
  coverage: GeoJSON.FeatureCollection,
): GeoJSON.MultiPolygon {
  const polygons = coverage.features.flatMap((f) =>
    f.geometry.type === "Polygon"
      ? [f.geometry.coordinates as Polygon]
      : f.geometry.type === "MultiPolygon"
        ? (f.geometry.coordinates as Polygon[])
        : [],
  );
  return {
    type: "MultiPolygon",
    coordinates: polygons.length
      ? union(polygons[0], ...polygons.slice(1))
      : [],
  };
}
export function coverageBounds(
  coverage: GeoJSON.FeatureCollection,
): [[number, number], [number, number]] {
  const points = mergeCoverage(coverage).coordinates.flat(2);
  return [
    [
      Math.min(...points.map((p) => p[0])),
      Math.min(...points.map((p) => p[1])),
    ],
    [
      Math.max(...points.map((p) => p[0])),
      Math.max(...points.map((p) => p[1])),
    ],
  ];
}
const R = 6371008.8;
const rad = (n: number) => (n * Math.PI) / 180;
function distance(a: number[], b: number[]) {
  const h =
    Math.sin(rad(b[1] - a[1]) / 2) ** 2 +
    Math.cos(rad(a[1])) *
      Math.cos(rad(b[1])) *
      Math.sin(rad(b[0] - a[0]) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** No additional coverage can be reached beyond the furthest boundary vertex. */
export function maximumMiles(
  coverage: GeoJSON.FeatureCollection,
  center: [number, number] = [-84.391, 33.774],
) {
  const farthest = Math.max(
    0,
    ...mergeCoverage(coverage)
      .coordinates.flat(2)
      .map((p) => distance(center, p)),
  );
  return Math.min(
    50,
    Math.max(0.1, Math.ceil((farthest / 1609.344) * 10) / 10),
  );
}
/** The displayed selection matches the server's coverage AND distance filters. */
export function nearbyGeometry(
  coverage: GeoJSON.FeatureCollection,
  center: [number, number],
  radius: number,
): GeoJSON.MultiPolygon {
  const [lon, lat] = center.map(rad);
  const d = radius / R;
  const ring = Array.from({ length: 129 }, (_, i) => {
    const bearing = (2 * Math.PI * (i % 128)) / 128;
    const y = Math.asin(
      Math.sin(lat) * Math.cos(d) +
        Math.cos(lat) * Math.sin(d) * Math.cos(bearing),
    );
    const x =
      lon +
      Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(lat),
        Math.cos(d) - Math.sin(lat) * Math.sin(y),
      );
    return [(x * 180) / Math.PI, (y * 180) / Math.PI] as [number, number];
  });
  const merged = mergeCoverage(coverage);
  return {
    type: "MultiPolygon",
    coordinates: merged.coordinates.length
      ? intersection(merged.coordinates as MultiPolygon, [ring])
      : [],
  };
}
