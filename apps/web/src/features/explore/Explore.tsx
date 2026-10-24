"use client";
import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";
import {
  Navigation,
  SlidersHorizontal,
  MapPin,
  ArrowRight,
  RotateCcw,
  List,
  Map,
} from "lucide-react";
import { api, send } from "@/lib/api";
import type {
  Activity,
  Config,
  EventPage,
  Filters,
  MapPoints,
} from "@/lib/types";
import { Loading, Notice } from "@/components/ui";
import { weekLabel } from "@/lib/time";
import { maximumMiles } from "@/features/map/coverage";
import PanelDivider from "./PanelDivider";
import EventDayGroups from "./EventDayGroups";
import EventDetails from "./EventDetails";
import { usePlans } from "@/features/plans/usePlans";
const ActivityMap = dynamic(() => import("@/features/map/ActivityMap"), {
  ssr: false,
  loading: () => (
    <div className="map-panel">
      <Loading label="Loading map…" />
    </div>
  ),
});
const defaultFilters: Filters = {
  week: "this",
  categories: [],
  geo_mode: "none",
};
export default function Explore() {
  const [hoveredActivity, setHoveredActivity] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [config, setConfig] = useState<Config | null>(null),
    [filters, setFilters] = useState<Filters>(defaultFilters),
    [page, setPage] = useState<EventPage | null>(null),
    [points, setPoints] = useState<MapPoints | null>(null),
    [selected, setSelected] = useState<Activity | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [geoError, setGeoError] = useState(""),
    [retry, setRetry] = useState(0),
    [radius, setRadius] = useState(2),
    [locating, setLocating] = useState(false),
    [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const maxMiles = config ? maximumMiles(config.coverage, filters.center) : 2;
  const board = usePlans();
  function chooseRadius(value: number) {
    const next = Math.max(0.1, Math.min(maxMiles, Math.round(value * 10) / 10));
    setRadius(next);
    setFilters((f) => ({ ...f, radius_m: next * 1609.344 }));
  }
  function chooseCenter(center: [number, number]) {
    const limit = config ? maximumMiles(config.coverage, center) : 2;
    const next = Math.min(radius, limit);
    setRadius(next);
    setFilters((f) => ({
      week: f.week,
      categories: f.categories,
      geo_mode: "radius",
      center,
      radius_m: next * 1609.344,
    }));
  }
  const generation = useRef(0);
  useEffect(() => {
    api<Config>("/config")
      .then(setConfig)
      .catch((e) => setError(e.message));
    board.reload().catch((e) => board.setError(e.message));
    const p = new URLSearchParams(location.search);
    const week = p.get("week") === "next" ? "next" : "this";
    const cats = p.getAll("category");
    setFilters({ ...defaultFilters, week, categories: cats });
  }, []); // eslint-disable-line
  useEffect(() => {
    generation.current += 1;
    setHoveredActivity(null);
    const p = new URLSearchParams();
    p.set("week", filters.week);
    filters.categories.forEach((c) => p.append("category", c));
    history.replaceState(null, "", "?" + p.toString());
    if (filters.geo_mode === "radius" && !filters.center) {
      setPage(null);
      setPoints(null);
      setLoading(false);
      return;
    }
    if (filters.geo_mode === "polygon" && !filters.polygon) {
      setPage(null);
      setPoints(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      api<EventPage>("/events/search", {
        ...send("POST", { ...filters, limit: 30 }),
        signal: controller.signal,
      }).then((p) => {
        if (!controller.signal.aborted) setPage(p);
      }),
      api<MapPoints>("/events/map", {
        ...send("POST", filters),
        signal: controller.signal,
      }).then((m) => {
        if (!controller.signal.aborted) setPoints(m);
      }),
    ])
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, retry]);
  function mode(value: Filters["geo_mode"]) {
    setGeoError("");
    if (value !== "none") setView("map");
    const center: [number, number] = userLocation || [-84.391, 33.774];
    const nextRadius = Math.min(
      radius,
      config ? maximumMiles(config.coverage, center) : 2,
    );
    if (value === "radius") setRadius(nextRadius);
    setFilters((f) => ({
      week: f.week,
      categories: f.categories,
      geo_mode: value,
      ...(value === "radius"
        ? { center, radius_m: nextRadius * 1609.344 }
        : {}),
    }));
  }
  function locate() {
    if (locating) return;
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError(
        "Location is unavailable in this browser. You can still explore the map.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const position: [number, number] = [
          p.coords.longitude,
          p.coords.latitude,
        ];
        setUserLocation(position);
        setView("map");
        if (filters.geo_mode === "radius") chooseCenter(position);
        setLocating(false);
        setGeoError("");
      },
      (error) => {
        setGeoError(
          error.code === 1
            ? "Location permission is blocked. Allow location access in your browser settings and try again."
            : error.code === 3
              ? "Finding your location took too long. Try again."
              : "Your location could not be found. Check your device location settings and try again.",
        );
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 0 },
    );
  }
  async function select(id: string) {
    try {
      setSelected(await api<Activity>("/events/" + id));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function more() {
    if (page?.next_cursor == null) return;
    const requestGeneration = generation.current;
    setLoading(true);
    try {
      const p = await api<EventPage>(
        "/events/search",
        send("POST", { ...filters, cursor: page.next_cursor }),
      );
      if (requestGeneration === generation.current)
        setPage((old) =>
          old ? { ...p, items: [...old.items, ...p.items] } : p,
        );
    } catch (e) {
      if (requestGeneration === generation.current)
        setError((e as Error).message);
    } finally {
      if (requestGeneration === generation.current) setLoading(false);
    }
  }
  return (
    <>
      <section className="city-hero" aria-labelledby="city-title">
        <div className="city-hero-copy">
          <span className="eyebrow">
            <span className="blue-dot" /> Atlanta, Georgia
          </span>
          <h1 id="city-title">Your Atlanta week.</h1>
          <p>A little closer to your next good plan.</p>
          <a className="city-hero-link" href="#discover">
            Find your kind of out <ArrowRight size={17} />
          </a>
        </div>
        <div className="city-hero-caption">
          <MapPin size={15} /> Downtown · Midtown · Georgia Tech
        </div>
      </section>
      <div className="discovery-heading" id="discover">
        <div>
          <h2>Make room for something good.</h2>
          <p>Explore what’s on, then make it a plan.</p>
        </div>
        <div className="location-action">
          <button
            className="primary"
            disabled={locating}
            aria-busy={locating}
            aria-describedby="location-feedback"
            onClick={() => locate()}
          >
            <Navigation size={17} aria-hidden="true" />
            {locating ? "Locating…" : "Locate me"}
          </button>
          <p
            id="location-feedback"
            role="status"
            className={geoError ? "error-text" : ""}
          >
            {geoError ||
              (locating
                ? "Finding your current position…"
                : userLocation
                  ? "Your position is marked on the map."
                  : "Show your position on the map.")}
          </p>
        </div>
      </div>
      <section className="week-bar" aria-label="Discovery dates">
        <div className="segmented" aria-label="Week">
          {(["this", "next"] as const).map((w) => (
            <button
              key={w}
              aria-pressed={filters.week === w}
              className={filters.week === w ? "selected" : ""}
              onClick={() => setFilters((f) => ({ ...f, week: w }))}
            >
              {w === "this" ? "This week" : "Next week"}
            </button>
          ))}
        </div>
        <span className="week-dates">
          {weekLabel(page?.week_start, page?.week_end)}
        </span>
        <span className="timezone">Eastern time</span>
      </section>
      <div className="discovery-toolbar">
        <button
          aria-expanded={filtersOpen}
          aria-controls="browse-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal size={16} /> Filters
          {filters.categories.length ? ` (${filters.categories.length})` : ""}
        </button>
        <div className="segmented" role="group" aria-label="Discovery view">
          <button
            aria-label="List view"
            aria-pressed={view === "list"}
            className={view === "list" ? "selected" : ""}
            onClick={() => setView("list")}
          >
            <List size={16} /> List
          </button>
          <button
            aria-label="Map view"
            aria-pressed={view === "map"}
            className={view === "map" ? "selected" : ""}
            onClick={() => setView("map")}
          >
            <Map size={16} /> Map
          </button>
        </div>
      </div>
      {board.error && <Notice error>{board.error}</Notice>}
      {error && (
        <Notice error>
          {error}{" "}
          <button
            className="small"
            onClick={() => {
              if (!config)
                api<Config>("/config")
                  .then(setConfig)
                  .catch((e) => setError(e.message));
              setRetry((n) => n + 1);
            }}
          >
            Retry
          </button>
        </Notice>
      )}

      <div
        className="explorer"
        data-view={view}
        data-filters-open={filtersOpen}
      >
        <aside className="filter-panel" id="browse-filters">
          <h2>
            <SlidersHorizontal size={17} />
            Find your plans
          </h2>
          <fieldset>
            <legend>Activity types</legend>
            {(
              config?.categories || [
                "Football",
                "Sports",
                "Parade",
                "Music",
                "Arts",
                "Festival",
                "Georgia Tech",
                "Community",
              ]
            ).map((c) => (
              <label className="check" key={c}>
                <input
                  type="checkbox"
                  checked={filters.categories.includes(c)}
                  onChange={() =>
                    setFilters((f) => ({
                      ...f,
                      categories: f.categories.includes(c)
                        ? f.categories.filter((x) => x !== c)
                        : [...f.categories, c],
                    }))
                  }
                />
                <span>{c}</span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Choose an area</legend>
            <label className="field-label" htmlFor="geo-mode">
              Location filter
            </label>
            <select
              id="geo-mode"
              value={filters.geo_mode}
              onChange={(e) => mode(e.target.value as Filters["geo_mode"])}
            >
              <option value="none">All neighborhoods</option>
              <option value="radius">Nearby activities</option>
              <option value="polygon">Draw an area</option>
            </select>
            {filters.geo_mode === "radius" && (
              <>
                <label className="radius-label" htmlFor="distance">
                  Within <strong>{radius} miles</strong>
                </label>
                <input
                  id="distance"
                  aria-describedby="coverage-distance-note"
                  type="range"
                  min="0.1"
                  max={maxMiles}
                  step="0.1"
                  value={radius}
                  onChange={(e) => {
                    chooseRadius(Number(e.target.value));
                  }}
                />
                <label className="sr-only" htmlFor="distance-number">
                  Distance in miles
                </label>
                <input
                  id="distance-number"
                  aria-describedby="coverage-distance-note"
                  type="number"
                  min="0.1"
                  max={maxMiles}
                  step="0.1"
                  value={radius}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && e.target.value !== "")
                      chooseRadius(n);
                  }}
                />
                <small id="coverage-distance-note">
                  Up to {maxMiles} miles from this center. Results stay inside
                  the green activity coverage boundary.
                </small>
                <small>Click the map or Locate me to change your center.</small>
              </>
            )}
            {filters.geo_mode === "polygon" && (
              <>
                <p className="muted">
                  Click points on the map, then finish your area.
                </p>
                <button className="small" onClick={() => mode("polygon")}>
                  Clear & redraw
                </button>
              </>
            )}
          </fieldset>
          <button
            className="text-button"
            onClick={() => {
              setFilters(defaultFilters);
              setGeoError("");
            }}
          >
            <RotateCcw size={14} />
            Reset filters
          </button>
          <div className="filter-foot">
            Something for everyone.
            <br />
            Check each activity’s eligibility before you go.
          </div>
        </aside>
        <section
          className="activities"
          aria-label="Activities"
          aria-busy={loading}
        >
          <div className="result-heading">
            <h2>
              {page?.total ?? "—"}{" "}
              {page?.total === 1 ? "activity" : "activities"}
            </h2>
            <span>{loading ? "Updating…" : "By date"}</span>
          </div>
          {!page && loading && <Loading label="Finding your next plan…" />}
          {!loading && page?.total === 0 && (
            <div className="empty">
              <MapPin size={32} />
              <h3>No activities in this selection.</h3>
              <p>Try another week, a wider area or fewer filters.</p>
              <button onClick={() => setFilters(defaultFilters)}>
                Reset filters
              </button>
            </div>
          )}
          {page && (
            <EventDayGroups
              onHighlight={setHoveredActivity}
              items={page.items}
              plans={board.plans}
              partial={page.next_cursor != null}
              onOpen={setSelected}
              onAdd={(event, status) => board.move(event, status)}
            />
          )}
          {page?.next_cursor != null && (
            <button className="load-more" onClick={more} disabled={loading}>
              Load more activities <ArrowRight size={15} />
            </button>
          )}
          <p className="data-note">
            Automatically collected from event sources. Availability and details
            may change.
          </p>
        </section>
        <PanelDivider />
        <div className="discovery-map">
          {config ? (
            <ActivityMap
              hoveredActivity={hoveredActivity}
              userLocation={userLocation}
              points={points}
              config={config}
              filters={filters}
              onCenter={chooseCenter}
              onPolygon={(polygon) => setFilters((f) => ({ ...f, polygon }))}
              onSelect={select}
            />
          ) : (
            <div className="map-panel">
              <Loading label="Opening the map…" />
            </div>
          )}
        </div>
      </div>
      {config && (
        <details className="sources-summary">
          <summary>Activity sources & last sync</summary>
          {config.sources.length ? (
            config.sources.map((s, i) => (
              <p key={i}>
                {s.name}: {s.count} activities ·{" "}
                {s.status === "failed" ? "Needs attention" : "Synced"} ·{" "}
                {new Date(s.last_run).toLocaleString("en-US", {
                  timeZone: "America/New_York",
                })}
              </p>
            ))
          ) : (
            <p>
              No source sync has completed yet. Activities appear after
              collection runs.
            </p>
          )}
        </details>
      )}
      {selected && (
        <EventDetails
          event={selected}
          plan={board.plans.find((p) => p.event_id === selected.id)}
          busy={board.busy}
          onClose={() => setSelected(null)}
          onAdd={(s) => {
            setSelected(null);
            board.move(selected, s);
          }}
        />
      )}
      {board.conflictDialog}
    </>
  );
}
