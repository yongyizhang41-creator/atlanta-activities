# Integration status and evidence

For the current public demo and enabled providers, see [Free demo deployment](demo-deployment.md). The provider notes below retain the original local integration verification history.

## Activity sources

- Georgia Tech Campus Calendar: https://calendar.gatech.edu/event-search ; public pagination and article.mercury-event times/eligibility were fetched and parsed on 2026-10-22. robots.txt allows these paths. Source has no embedded coordinates; unknown buildings require configured geocoding. Curated venue coordinates include provenance. Do not publish academic/non-entertainment items just because they are on the calendar.
- State Farm Arena: https://www.statefarmarena.com/events ; JSON-LD Event list fetched, including start/end times, venue and source. robots allows public pages. Arena coordinate: Wikidata Q1123297; no AI-estimated coordinates.
- Mercedes-Benz Stadium: https://www.mercedesbenzstadium.com/events ; official venue JSON-LD supplies coordinates. Event detail pages need parsing compatible with their schema; missing events must be reported, never invented. robots disallows query URLs.
- Downtown Atlanta: https://www.atlantadowntown.com/events now redirects to https://downtownatlantainc.com/events. Initial entry has no JSON-LD. Additional adapter work/usable endpoint is required for broad parade/festival coverage; not counted as a successful source.
- Discover Atlanta: https://discoveratlanta.com/events/main/ returned a challenge page to the local fetcher. Not enabled; no attempt to bypass challenge or access controls.

Each source is independently logged; zero publishable results and parser errors remain visible. Collection is not a guarantee of all Atlanta entertainment. Runtime checks robots; operators must also verify reuse/terms before public distribution.

## Providers

- OpenAI: https://developers.openai.com/api/reference/python — documented Responses endpoint, server REST integration; credentials/model absent, real model response not verified.
- Google: https://developers.google.com/identity/openid-connect/openid-connect — Authlib OIDC with state, nonce and PKCE. User accounts do not auto-merge by email. Client credentials absent, real redirect not verified.
- Resend: https://resend.com/docs/dashboard/emails/idempotency-keys — idempotency 24 hours; application retries at most 23 hours with identical payload. Verified domain/key absent, real send not verified.
- MapLibre GL JS: https://maplibre.org/maplibre-gl-js/docs/ — installed safe major 6.15 with named exports, client clustering and geographic selection. OpenFreeMap default basemap with attribution; MapTiler configurable.
- MapTiler is used only for the optional browser map. Keep the Web key's localhost restriction. No second key or upgrade is required.
- Backend geocoding uses Nominatim after existing coordinates and curated venues. The user explicitly approved this choice on 2026-10-22. [Public service policy](https://operations.osmfoundation.org/policies/nominatim/): low-volume only, one machine, one shared persistent cache, at most four requests per minute for periodic jobs. SQLite serializes requests across local processes at least 16 seconds apart; successful results cache for a year, missing/outside results for seven days. Network failures are not negative-cached. Do not expose this as a generic address search/autocomplete service. Only public event venues are submitted. Attribution appears on the map; OSM-derived coordinates are subject to ODbL. Public service availability is not guaranteed. For larger installations, use a self-hosted/contracted compatible endpoint via NOMINATIM_URL and share/migrate the cache; do not run independent caches on multiple machines.

No provider account has been created, no payment or public deployment has occurred.

## Additional source verification

HTML fallbacks now parse the current MBS event hero and explicitly labelled Event Start (not Gates Open), and Downtown listing cards with actual times and dates. Fixture tests pin both real page layouts. Actual follow-up run: MBS published 1 football event; Downtown parsed 3 in-window timed activities but withheld them because no trusted coordinates/geocoder were available. These HTML adapters supersede the initial missing-format notes above; geocoding and breadth remain the concrete gap.

The source of curated arena coordinates is stored alongside each entry in apps/api/data/venues.json. Service coverage polygons are deliberately product service boundaries, not claimed municipal neighborhood boundaries. Ambiguous recurring series without occurrence IDs retain date-specific identity to prevent saved-plan overwrites.
