"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { Map as MapGL, GeoJSONSource } from "maplibre-gl";
import { Maximize2, MapPinned } from "lucide-react";
import type { Config, Filters, MapPoints } from "@/lib/types";
import { cityMapStyle } from "./cityStyle";
import { Modal, Notice } from "@/components/ui";
import { mergeCoverage, nearbyGeometry, coverageBounds } from "./coverage";
import { uniqueActivities, type MapActivity } from "./mapSelection";
export default function ActivityMap({
  points,
  hoveredActivity,
  userLocation,
  config,
  filters,
  onCenter,
  onPolygon,
  onSelect,
}: {
  points: MapPoints | null;
  hoveredActivity?: string | null;
  userLocation: [number, number] | null;
  config: Config;
  filters: Filters;
  onCenter: (p: [number, number]) => void;
  onPolygon: (p: GeoJSON.Polygon) => void;
  onSelect: (id: string) => void;
}) {
  const mapStyle = config.map_style;
  const view = useRef<{
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  } | null>(null);
  const focusedLocation = useRef<[number, number] | null>(null);
  const node = useRef<HTMLDivElement>(null),
    map = useRef<MapGL | null>(null),
    latest = useRef({ filters, onCenter, onPolygon, onSelect });
  latest.current = { filters, onCenter, onPolygon, onSelect };
  const [loadedStyle, setLoadedStyle] = useState("");
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [choices, setChoices] = useState<MapActivity[]>([]),
    [vertices, setVertices] = useState<[number, number][]>([]);
  const verticesRef = useRef<[number, number][]>([]);
  useEffect(() => {
    if (!node.current) return;
    let m: MapGL;
    try {
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      m = new maplibregl.Map({
        container: node.current,
        center: view.current?.center || [-84.391, 33.774],
        zoom: view.current?.zoom ?? 12.4,
        bearing: view.current?.bearing ?? 0,
        pitch: view.current?.pitch ?? 0,
        attributionControl: {
          compact: true,
          customAttribution:
            'Venue geocoding: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>',
        },
      });
      map.current = m;
    } catch {
      setError(
        "This browser cannot display the map. You can still use the activity list.",
      );
      return;
    }
    const resizeObserver = new ResizeObserver(() => m.resize());
    if (node.current) resizeObserver.observe(node.current);
    m.addControl(new maplibregl.NavigationControl(), "top-right");
    m.on("error", () =>
      setError(
        "The map could not fully load. Check your connection; the activity list is still available.",
      ),
    );
    m.on("load", () => {
      m.addSource("coverage", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: mergeCoverage(config.coverage),
          properties: {},
        },
      });
      m.addLayer({
        id: "coverage-fill",
        type: "fill",
        source: "coverage",
        paint: { "fill-color": "#18694c", "fill-opacity": 0.1 },
      });
      m.addLayer({
        id: "coverage-boundary",
        type: "line",
        source: "coverage",
        paint: {
          "line-color": "#96dbb9",
          "line-width": 2.5,
          "line-dasharray": [3, 2],
        },
      });
      if (!view.current)
        m.fitBounds(coverageBounds(config.coverage), {
          padding: 35,
          duration: 0,
        });
      m.addSource("events", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 35,
        clusterMaxZoom: 15,
      });
      m.addLayer({
        id: "clusters",
        type: "circle",
        source: "events",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#a5edd6",
          "circle-radius": 22,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#203c50",
        },
      });
      m.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "events",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
        },
        paint: { "text-color": "#102e35" },
      });
      m.addLayer({
        id: "pins",
        type: "circle",
        source: "events",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#a5edd6",
          "circle-radius": 8,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#203c50",
        },
      });
      m.addSource("activity-hover", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "activity-hover-halo",
        type: "circle",
        source: "activity-hover",
        paint: {
          "circle-radius": 18,
          "circle-color": "#a5edd6",
          "circle-opacity": 0.24,
          "circle-stroke-color": "#a5edd6",
          "circle-stroke-width": 3,
        },
      });
      m.addSource("selection", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "selection-fill",
        type: "fill",
        source: "selection",
        filter: [
          "in",
          ["geometry-type"],
          ["literal", ["Polygon", "MultiPolygon"]],
        ],
        paint: { "fill-color": "#a5edd6", "fill-opacity": 0.1 },
      });
      m.addLayer({
        id: "selection-line",
        type: "line",
        source: "selection",
        paint: {
          "line-color": "#a5edd6",
          "line-width": 2,
          "line-dasharray": [3, 2],
        },
      });
      // Keep the collection boundary visible above the selected nearby area.
      m.moveLayer("coverage-boundary");
      m.on("click", async (e) => {
        const current = latest.current;
        if (
          current.filters.geo_mode === "polygon" &&
          !current.filters.polygon
        ) {
          const next = [
            ...verticesRef.current,
            [e.lngLat.lng, e.lngLat.lat] as [number, number],
          ];
          if (next.length < 199) {
            verticesRef.current = next;
            setVertices(next);
          }
          return;
        }
        const hits = m.queryRenderedFeatures(e.point, {
          layers: ["clusters", "pins"],
        });
        const cluster = hits.find(
          (f) => f.properties?.cluster_id !== undefined,
        );
        if (cluster) {
          const source = m.getSource("events") as GeoJSONSource;
          try {
            const leaves = await source.getClusterLeaves(
              Number(cluster.properties?.cluster_id),
              Number(cluster.properties?.point_count),
              0,
            );
            if (map.current !== m || latest.current !== current) return;
            setChoices(uniqueActivities(leaves));
          } catch {
            if (map.current === m)
              setError(
                "Activities could not be loaded. Click the marker to try again.",
              );
          }
          return;
        }
        const activities = uniqueActivities(hits);
        if (activities.length > 1) {
          setChoices(activities);
          return;
        }
        if (activities.length === 1) {
          current.onSelect(activities[0].id);
          return;
        }
        if (current.filters.geo_mode === "radius")
          current.onCenter([e.lngLat.lng, e.lngLat.lat]);
      });
      setLoadedStyle(mapStyle);
      setReady(true);
    });
    m.setStyle(mapStyle, {
      transformStyle: (_previous, next) => cityMapStyle(next),
    });
    return () => {
      const center = m.getCenter();
      view.current = {
        center: [center.lng, center.lat],
        zoom: m.getZoom(),
        bearing: m.getBearing(),
        pitch: m.getPitch(),
      };
      resizeObserver.disconnect();
      m.remove();
      map.current = null;
      setReady(false);
    };
  }, [mapStyle]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !userLocation) return;
    const element = document.createElement("div");
    element.className = "map-user-location";
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", "Your current location");
    element.dataset.longitude = String(userLocation[0]);
    element.dataset.latitude = String(userLocation[1]);
    const label = document.createElement("span");
    label.className = "map-user-location-label";
    label.textContent = "You are here";
    element.appendChild(label);
    const marker = new maplibregl.Marker({ element, anchor: "center" })
      .setLngLat(userLocation)
      .addTo(m);
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (focusedLocation.current !== userLocation)
      m.easeTo({
        center: userLocation,
        zoom: Math.max(m.getZoom(), 13),
        duration: reducedMotion ? 0 : 650,
      });
    focusedLocation.current = userLocation;
    return () => {
      marker.remove();
    };
  }, [userLocation, ready]);
  useEffect(() => {
    if (ready && map.current)
      (map.current.getSource("events") as GeoJSONSource)?.setData(
        points || { type: "FeatureCollection", features: [] },
      );
    setChoices([]);
  }, [points, ready]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const feature = points?.features.find(
      (feature) => feature.properties.id === hoveredActivity,
    );
    (m.getSource("activity-hover") as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: feature ? [feature] : [],
    });
    if (!feature) return;
    const coordinates = feature.geometry.coordinates as [number, number];
    if (!coordinates.every(Number.isFinite)) return;
    const element = document.createElement("div");
    element.className = "map-activity-preview";
    element.setAttribute("role", "img");
    element.setAttribute(
      "aria-label",
      `Map location for ${feature.properties.title}`,
    );
    element.dataset.longitude = String(coordinates[0]);
    element.dataset.latitude = String(coordinates[1]);
    const dot = document.createElement("span");
    dot.className = "map-activity-preview-dot";
    dot.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "map-activity-preview-label";
    label.textContent = feature.properties.title;
    element.append(dot, label);
    const marker = new maplibregl.Marker({ element, anchor: "center" })
      .setLngLat(coordinates)
      .addTo(m);
    const projected = m.project(coordinates);
    const width = m.getContainer().clientWidth;
    const height = m.getContainer().clientHeight;
    const outside =
      width > 0 &&
      height > 0 &&
      (projected.x < 100 ||
        projected.x > width - 100 ||
        projected.y < 90 ||
        projected.y > height - 40);
    let previewPanActive = false;
    const panFinished = () => {
      previewPanActive = false;
    };
    if (outside) {
      m.on("moveend", panFinished);
      previewPanActive = true;
      m.easeTo({
        center: coordinates,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 450,
      });
    }
    return () => {
      marker.remove();
      if (previewPanActive) m.stop();
      m.off("moveend", panFinished);
    };
  }, [hoveredActivity, points, ready]);
  useEffect(() => {
    verticesRef.current = [];
    setVertices([]);
  }, [filters.geo_mode, filters.polygon]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    let geometry: GeoJSON.Geometry | null = null;
    if (filters.geo_mode === "polygon") {
      geometry =
        filters.polygon ||
        (vertices.length > 1
          ? { type: "LineString", coordinates: vertices }
          : null);
    }
    if (filters.geo_mode === "radius" && filters.center && filters.radius_m) {
      geometry = nearbyGeometry(
        config.coverage,
        filters.center,
        filters.radius_m,
      );
    }
    (m.getSource("selection") as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: geometry ? [{ type: "Feature", geometry, properties: {} }] : [],
    });
  }, [filters, vertices, ready, config.coverage]);
  function finish() {
    if (vertices.length < 3) return;
    onPolygon({ type: "Polygon", coordinates: [[...vertices, vertices[0]]] });
  }
  return (
    <section
      className="map-panel"
      aria-label="Activity map"
      data-ready={ready}
      data-highlighted-activity={
        points?.features.some((f) => f.properties.id === hoveredActivity)
          ? hoveredActivity
          : undefined
      }
      data-style={loadedStyle}
    >
      <div className="map-top">
        <span>
          <MapPinned size={15} />
          Your activity map
        </span>
        <button
          className="icon-button"
          aria-label="Reset map view"
          onClick={() =>
            map.current?.fitBounds(coverageBounds(config.coverage), {
              padding: 40,
            })
          }
        >
          <Maximize2 size={16} />
        </button>
      </div>
      <div className="coverage-legend">
        <span aria-hidden="true" /> <strong>Activity coverage</strong>
        <small>
          Downtown · Midtown · Georgia Tech
          <br />
          Activities are collected only inside the green boundary.
        </small>
      </div>
      <div ref={node} className="map-canvas" />
      {choices.length > 0 && (
        <Modal
          title={`${choices.length} activities on this marker`}
          description="Choose an activity to view its details."
          onClose={() => setChoices([])}
        >
          <ul className="map-activity-choices">
            {choices.map((activity) => (
              <li key={activity.id}>
                <button
                  onClick={() => {
                    setChoices([]);
                    onSelect(activity.id);
                  }}
                >
                  <strong>{activity.title}</strong>
                  <span className="muted">{activity.category}</span>
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {error && (
        <div className="map-error">
          <Notice error>{error}</Notice>
        </div>
      )}
      {filters.geo_mode === "polygon" && !filters.polygon && (
        <div className="draw-toolbar">
          <span>Click at least 3 points to outline your area.</span>
          <button
            className="small"
            disabled={!vertices.length}
            onClick={() => {
              const v = vertices.slice(0, -1);
              verticesRef.current = v;
              setVertices(v);
            }}
          >
            Undo point
          </button>
          <button
            className="small primary"
            disabled={vertices.length < 3}
            onClick={finish}
          >
            Finish area
          </button>
        </div>
      )}
      {filters.geo_mode === "radius" && !filters.center && (
        <div className="draw-toolbar">
          Click on the map to set a center, or use your location.
        </div>
      )}
      <div className="map-caption">
        <span className="pin-dot" />
        {points?.total ?? 0} activities in your selection
        <span>Downtown · Midtown · GT</span>
      </div>
    </section>
  );
}
