export type Activity = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  venue: string;
  address: string;
  latitude: number;
  longitude: number;
  categories: string[];
  eligibility: string;
  price: string;
  registration: string;
  status: string;
  version: number;
  source_urls: string[];
  last_verified_at: string;
};
export type User = {
  id: string;
  email: string;
  verified: boolean;
  has_password: boolean;
  has_google: boolean;
};
export type Conflict = {
  event_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  overlap_start: string;
  overlap_end: string;
};
export type Reminder = {
  editable: boolean;
  id: string;
  event_id: string;
  remind_at: string;
  status: string;
  sent_at: string | null;
  error: string | null;
};
export type Plan = {
  event_id: string;
  status: "maybe" | "going";
  position: number;
  version: number;
  notice: string | null;
  event: Activity;
  conflicts: Conflict[];
  unknown_end_events: { id: string; title: string }[];
  has_sent_reminder: boolean;
  reminder: Reminder | null;
  reminders: Reminder[];
};
export type Filters = {
  week: "this" | "next";
  categories: string[];
  geo_mode: "none" | "radius" | "polygon";
  center?: [number, number];
  radius_m?: number;
  polygon?: GeoJSON.Polygon;
  cursor?: number;
  limit?: number;
};
export type EventPage = {
  items: Activity[];
  total: number;
  next_cursor: number | null;
  week_start: string;
  week_end: string;
  server_now: string;
};
export type MapPoints = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  { id: string; title: string; category: string }
> & { total: number };
export type Config = {
  categories: string[];
  map_style: string;
  coverage: GeoJSON.FeatureCollection;
  timezone: string;
  services: { google: boolean; ai: boolean; email: boolean };
  sources: {
    name: string;
    last_run: string;
    finished_at: string | null;
    count: number;
    status: string;
  }[];
};
