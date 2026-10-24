import { expect, it } from "vitest";
import type { StyleSpecification } from "maplibre-gl";
import { cityMapStyle } from "./cityStyle";

it("restyles land, water, roads and labels without changing source attribution or geometry", () => {
  const original: StyleSpecification = {
    version: 8,
    glyphs: "https://example.test/{fontstack}/{range}.pbf",
    sources: {
      city: {
        type: "vector",
        tiles: ["https://example.test/{z}/{x}/{y}.pbf"],
        attribution: "Required attribution",
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#fff" },
      },
      {
        id: "water",
        type: "fill",
        source: "city",
        "source-layer": "water",
        paint: { "fill-color": "#fff" },
      },
      { id: "land", type: "fill", source: "city", "source-layer": "landuse" },
      {
        id: "road",
        type: "line",
        source: "city",
        "source-layer": "transportation",
        paint: { "line-width": 3 },
      },
      {
        id: "place",
        type: "symbol",
        source: "city",
        layout: { "text-field": ["get", "name"] },
      },
    ],
  };
  const styled = cityMapStyle(original);
  expect(styled.sources).toEqual(original.sources);
  expect(styled.glyphs).toBe(original.glyphs);
  expect(styled.layers.map((layer) => layer.id)).toEqual(
    original.layers.map((layer) => layer.id),
  );
  expect(styled.layers[0].paint).toMatchObject({
    "background-color": "#293f55",
  });
  expect(styled.layers[1].paint).toMatchObject({ "fill-color": "#172e46" });
  expect(styled.layers[2].paint).toMatchObject({ "fill-color": "#344c61" });
  expect(styled.layers[3].paint).toMatchObject({
    "line-width": 3,
    "line-color": "#8296a8",
  });
  expect(styled.layers[4].paint).toMatchObject({
    "text-color": "#e1ebf2",
    "text-halo-color": "#21364b",
  });
  expect(original.layers[0].paint).toMatchObject({
    "background-color": "#fff",
  });
});
