import type { StyleSpecification, LayerSpecification } from "maplibre-gl";

/** Restyle the configured vector basemap, preserving its data, layout and credits. */
export function cityMapStyle(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    name: "ATL / Out · City Slate",
    layers: style.layers.map((layer): LayerSpecification => {
      const name =
        `${layer.id} ${"source-layer" in layer ? layer["source-layer"] : ""}`.toLowerCase();
      switch (layer.type) {
        case "background":
          return {
            ...layer,
            paint: { ...layer.paint, "background-color": "#293f55" },
          };
        case "fill": {
          const color = /water|ocean/.test(name)
            ? "#172e46"
            : /park|landcover|wood|grass/.test(name)
              ? "#315455"
              : /building/.test(name)
                ? "#435c70"
                : "#344c61";
          return {
            ...layer,
            paint: {
              ...layer.paint,
              "fill-color": color,
              "fill-outline-color": color,
            },
          };
        }
        case "line": {
          const color = /water/.test(name)
            ? "#172e46"
            : /boundary|admin/.test(name)
              ? "#71899e"
              : /casing|outline/.test(name)
                ? "#263c51"
                : /motorway|trunk|primary|transportation|road/.test(name)
                  ? "#8296a8"
                  : "#536f87";
          return { ...layer, paint: { ...layer.paint, "line-color": color } };
        }
        case "symbol":
          return {
            ...layer,
            paint: {
              ...layer.paint,
              "text-color": "#e1ebf2",
              "text-halo-color": "#21364b",
              "text-halo-width": 1.5,
            },
          };
        case "fill-extrusion":
          return {
            ...layer,
            paint: { ...layer.paint, "fill-extrusion-color": "#435c70" },
          };
        case "circle":
          return {
            ...layer,
            paint: { ...layer.paint, "circle-color": "#91c6be" },
          };
        default:
          return layer;
      }
    }),
  };
}
