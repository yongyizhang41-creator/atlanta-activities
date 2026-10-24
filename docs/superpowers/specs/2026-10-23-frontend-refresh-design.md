# Frontend visual refresh — proposed direction

Status: user selected both city-guide Day and nightlife Night modes with a user-controlled switch. Scope: existing Next.js/React English application, preserving all activity, auth, map, planning, AI and reminder behavior.

## Recommendation: Atlanta city activity guide

A clear, bright city guide for Atlanta residents and Georgia Tech students choosing activities, using the map, and organizing Maybe/Going plans. Prioritize useful event dates, venues and selection states rather than a promotional hero.

### Palette and type

- Cloud canvas #F3F6F5, white surfaces #FFFFFF.
- Ink #142D38 for headings/navigation; muted slate #52646D for secondary content.
- Deep teal #126659 for primary actions and selected controls.
- Orange #C24B20 for small active-plan accents; no white-on-light-orange buttons.
- Green coverage boundary and a separate cyan device-location marker retain their geographic meaning; event pins remain visually distinct.
- Use an intentional sans-serif stack (Avenir Next, Avenir, Segoe UI, sans-serif), strong 40–52px desktop headings and readable 15–16px primary content. Compact factual metadata >=12px. Remove decorative italic headline fragments, uppercase eyebrows and monospace metadata.

### Layout

Left-aligned authenticated application shell. Explore keeps filters / event list / persistent map on desktop, with wider content rows and a clear weekly navigation strip. Event cards get a compact date column inspired by an event ticket; the date conveys actual start information, not decorative numbering. Map coverage legend and user-location marker remain accessible and visible.

My plans keeps two drag/drop columns, visually distinct through restrained teal and warm neutral header accents. Stronger card titles, clearer upcoming-reminder summaries and predictable action placement. Reuse existing keyboard/button alternatives.

Auth uses the same identity and an asymmetric city-route panel rather than a generic marketing/photo hero. Settings, event details, AI chat and reminder dialogs share the same field, focus, spacing and button treatments.

```
Brand / Explore / My plans                         Account
Heading + concise location context
This week / Next week                 Actual date range
Filters       Date + activity information       Coverage map
              Event actions                     You are here
```

Mobile stacks controls, bounded map and activity content. Navigation remains readable, dialogs scroll within the viewport, and touch targets are at least 44px where space permits. No horizontal page scrolling.

## Review against current product

The existing serif/italic headline, uppercase labels, small metadata and repeated rounded-card styling are replaced with a schedule-oriented hierarchy. Preserve familiar labels and routes so functionality and existing tests remain meaningful. No fake events, testimonials, invented metrics, external service configuration or API behavior changes.

UI/UX Pro Max searches were run for the actual Next.js application. Whole-page results favored marketing/wedding layouts and were rejected as unsuitable; no unverified generated design-system output was persisted. Apply its accessibility and interaction guidance alongside frontend-design's subject-specific direction and the project's existing behavior contract.

## Alternatives offered

- Nightlife: dark background and higher visual contrast, appropriate if the product should emphasize evening entertainment.
- Campus: softer neutral surfaces and more whitespace, appropriate if everyday campus use is the dominant audience.

## Implementation and validation after direction is selected

Update DESIGN.md and the existing stylesheet in place, avoiding duplicate override blocks. Make presentation-only changes in Shell, Explore, EventCard, Board and AuthPage; retain accessible names and interaction handlers. Unify fields, dialogs and statuses through the existing components/ui.tsx owners. Inspect map colors for consistency while preserving marker/coverage semantics.

Verify TypeScript, formatting and existing unit/browser journeys. Capture and inspect Explore, populated My plans, auth and reminder-dialog screens at desktop and mobile widths; check overflow, focus, readable contrast, map resizing, drag/drop alternatives and reduced motion. Keep provider keys and personal user information out of screenshots by using labelled local test fixtures.

## Selected dual-mode implementation

Default Day. A visible Day/Night button appears on authenticated navigation and auth screens. Browser-local preference persists across reloads/navigation; no account, API-key or database changes. A small pre-paint bootstrap sets data-theme to avoid a light flash for returning Night users. Night uses deep blue surfaces (#0C1720 / #142630), light text (#EEF3F6), mint primary actions (#83DFC4) and warm orange accents (#F5A66F). Both palettes share layout, accessible names and all behavior. Semantic theme tokens replace hardcoded UI colors rather than duplicating entire page styles.

Map uses the existing configured Day style and OpenFreeMap Dark at night (documented free Dark style; verify endpoint at runtime). Preserve selection, current location and viewport while changing map styles. No CSS inversion of tiles. Each palette retains a distinct green coverage boundary, cyan device marker and blue event pins.
