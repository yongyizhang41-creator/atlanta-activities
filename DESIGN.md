# ATL / Out — Day city guide

Purpose: Atlanta residents and Georgia Tech students discover this/next week's activities through a map, then organize realistic Maybe/Going plans. English interface; America/New_York dates. The sole theme is Day, retaining the Atlanta night photograph and smoke-blue glass atmosphere. There is no theme switch or system-dependent styling.

## Visual direction

A city weekend magazine: a bounded Atlanta skyline photograph leads into a quiet discovery canvas. Left-aligned sans-serif headlines, warm date accents and readable activity cards establish the hierarchy. The user approved this direction on 2026-10-23, replacing the earlier map-led/no-hero direction. No fabricated popularity, event images or recommendations.

## Tokens and ownership

The existing apps/web/src/app/globals.css is the sole visual-token owner. Auth uses the fixed Day form palette. Authenticated pages retain smoke-blue glass, pale readable ink, mint actions with dark text, gold details and semantic category/status tokens. There are no Night variants.

Typography: Avenir Next/Avenir/Segoe UI/sans-serif, no external font download. Headings 34–52px, event titles 19px, body 15px, supporting metadata mostly 12–14px. No display serif or monospace metadata. Shared spacing 4/8/12/16/24/32/48; form controls ~42–44px; smaller category badges are labels, not controls. Card radius 8–10px, map/columns 12px, dialog 16px; avoid equal-radius equal-shadow boxes.

## Layout

The supplied skyline (`apps/web/public/images/atlanta-skyline.png`) is local and decorative. Following the user’s glassmorphism direction, authenticated pages use it as a shared fixed city backdrop; auth retains its story image. The Explore hero uses white text on dark frosted glass. Authenticated pages use the glass city backdrop described below; auth retains its dedicated story photograph.

Explore fills the available viewport width with 24–48px desktop side gutters, compact desktop filter rail, wider activity list and secondary sticky map. At 900px and below, a labelled List/Map button group switches presentation without unmounting the map or resetting filters. MapLibre owns container resizing via ResizeObserver. At 600px and below, Filters is an accessible disclosure button; geographic-mode selection or successful location opens the map view. Desktop always shows both views regardless of mobile state. Event cards retain real dates, eligibility, details, status and plan actions. Descriptions use two-line clamping. My plans/settings retain their canonical structure and shared palette; auth uses the skyline only behind its dark story panel.

## Theme and interaction

The root HTML element statically declares Day. ThemeToggle, theme hooks/storage subscriptions and bootstrap scripts have been removed. Stored obsolete preferences and system dark mode are ignored.

MapLibre uses the configured vector provider with the City Slate transform in features/map/cityStyle.ts: navy background #293F55, blue-gray land #344C61, water #172E46, park #315455, roads #8296A8 and pale labels #E1EBF2 with a dark halo. Provider data, glyphs, sprite paths and Attribution remain unchanged. Activity pins/clusters are mint with dark outlines and counts, coverage green, device position cyan. Native controls, popups and attribution use matching slate surfaces. No whole-map CSS color filters.

Existing UX-CONTRACT.md remains the behavior authority: Radix focus-managed dialogs, labelled native fields, visible focus, drag button alternatives, application-owned errors, loading/disabled states, strict reminder times and automatic plan expiry. Respect reduced motion. Inspect the unified theme on desktop/mobile with labelled test fixtures, never personal user information.

Explore location: a primary Locate me action remains visible in the page intro at desktop and mobile widths, with a reserved status area for locating, success and actionable permission/timeout feedback. It uses the existing device marker and preserves activity filters; Nearby uses the same action to update its search center. Nearby starts at the last device location or the Atlanta default center; the range updates selection geometry and queries results on input, with map results applied independently of list loading.


## Weekend journal

Approved 2026-10-23: Explore groups the server-ordered loaded activities by `America/New_York` calendar day. `features/explore/dayGroups.ts` owns grouping; `EventDayGroups.tsx` owns date sections, ordered lists and count labels. Counts say “loaded” while a next cursor exists. Dates are semantic ISO calendar dates; card start times retain their full timestamp and accessible date label. The timeline represents start order only; end time, unknown end, eligibility and conflicts retain existing behavior. The optional `EventCard` journal variant is used only by Explore; other callers retain their date rail.

Explore has no fixed desktop content cap; desktop side gutters are clamp(24px, 2vw, 48px). Desktop list/map ratio 1.5:1 with a 192px filter rail. The filter surface is light stone (#EFEEE7) in Day and #162C35 in Night; journal rules use #D9D5C9/#3C5159. Warm start times/dots, white/theme-surface cards and thin connectors create rhythm without decorative images. Card hover and focus-within share a category accent border and glass highlight; reduced motion is respected. Desktop map stays sticky with viewport-clamped 320–780px height (the canvas can shrink on short desktop screens); mobile keeps the existing view switch and narrower journal rail.

Explore desktop split: features/explore/PanelDivider.tsx owns the draggable list/map separator above 900px. Pointer capture and Left/Right keys resize both tracks with 280px minimum widths; double-click or Home resets the default 60/40 ratio. Browser-local ratio persists with optional storage. Mobile List/Map presentation is unchanged. ActivityMap observes container size and resizes its canvas without resetting camera or filters.


Explore activity color (2026-10-23): preserve the existing journal layout; the primary activity category owns the card tint, leading border, start time, timeline dot and category label. Georgia Tech uses gold, sports/football blue, music purple, arts berry, festival burnt orange, parade pink and community teal. globals.css owns semantic category tokens. Backgrounds are quiet tinted surfaces with readable ink; no gradients, fabricated images or alternating colors unrelated to activity data. Hover/focus changes the category border without floating shadows. Status badges and Going/Maybe actions retain their shared semantic colors.


## Glass city direction

User requested photographic glassmorphism on 2026-10-23, superseding the opaque discovery canvas. The existing local Atlanta skyline becomes a fixed decorative background with a cool blue / warm dusk wash. `globals.css` owns glass tokens: smoke-blue glass at 48% opacity, strong controls at 78%. Thin reflective edges, inset highlights and 22px backdrop blur establish depth. Explore intro, week bar, filter rail, list shell and map frame share this material; individual activity cards retain restrained category accents with translucent surfaces. Hero uses darker glass and white copy over the same city backdrop. Typography, list/map resizing, responsive views and all domain behavior remain unchanged. No new remote images or fonts. Auth remains a separate high-contrast form layout. Reduced-transparency and unsupported-filter fallbacks use stronger surfaces; forced colors uses Canvas/CanvasText. Background never receives pointer input and remains a decorative CSS layer.


Glass correction (2026-10-23): user rejected the milky white panels. Day authenticated surfaces now use smoke-blue glass at 48% with light ink and mint actions; controls use 78%. City wash drops to 12–26% to preserve the photograph. List shell is only 16% smoke, avoiding stacked opaque layers; cards use their own blur and a 6% category tint. Auth palette remains separate. The former Night variant is removed. This supersedes the earlier white-glass Day treatment.


## Premium motion

User approved the detailed motion request on 2026-10-23. `components/motion/variants.ts` owns springs (card 380/23, layout 340/30, controls 440/24) and capped 55ms entrance stagger. `MotionProvider` owns reduced-motion policy and delegated button/nav/select/touch press feedback; map controls and board drag handles are excluded. `CityBackdrop` owns a fixed decorative scene: 75s slow drift and at most 12px/8px pointer parallax via motion values, pausing drift while hidden. The same local city image is retained. No map container transforms.

Explore journal cards hover to y=-7, scale=1.02 with spring rebound, shadow and mint rim. Time, title, facts and actions move slightly at different delays. Keyed day/entry position-only layout and presence animate filter/page changes while prior data stays visible during fetch; sticky map and divider remain outside layout motion. Card hover or keyboard focus supplies an activity ID to MapLibre’s independent halo source, including points inside clusters, without moving the camera. Touch uses control press feedback; hover motion is pointer-aware. Reduced motion disables transforms/layout, drift, parallax and pulses, leaving brief opacity and visible focus feedback. No claim of measured 60 FPS; use browser performance profiling on target hardware for that threshold.


## Single Day theme and City Slate map

Requested 2026-10-23: Day is the only theme. No theme toggle, theme persistence, automatic OS mode or alternate dark CSS remains. “Day” is a name, not an instruction to replace the retained city-night glass palette with white. The configured MapLibre vector style is transformed before attachment to prevent a white basemap flash; the same provider/attribution is preserved. All spring interactions remain independent. This supersedes every earlier reference to multiple themes in historical design notes.


My plans column motion: Maybe/Going reuse the shared card spring (y=-7, scale=1.02) and mint glow. A stationary `board-column-slot` owns each drop target; its visual surface animates. While any board drag is active, both surfaces immediately return to identity and hover transforms are suspended. Reduced motion disables the hover transform. Existing sortable activity transforms stay owned by dnd-kit.


Authentication glass unification (2026-10-23): the user rejected the white form side. AuthPage now shares CityBackdrop and the authenticated smoke-blue token palette; the desktop split is retained, with continuous city imagery across both halves. The right form sits in a 48% glass panel with reflective rim, mint primary action, slate Google action and translucent navy fields. Shared auth modes inherit the same layout. The panel enters with the shared spring; form controls keep global press feedback. Reduced motion/transparency and forced-colors fallbacks remain. Existing email/password/Google/token flows are unchanged. This supersedes earlier notes that auth keeps a separate light form palette.


Activity hover location preview: a gold DOM marker and safe text title label appear at the hovered/focused event’s exact coordinates, separately from clustered event layers. Locations outside the readable map viewport trigger a 450ms pan at unchanged zoom, respecting reduced motion; visible points do not move the camera. Leaving the preview removes the marker without changing filters or device location. Rapid hover changes cancel only the preview-initiated pan. Marker content never intercepts map gestures.

Authentication video mosaic (2026-10-23): user requested multiple real Atlanta night clips. `features/auth/VideoMosaicBackground.tsx` owns an auth-only fixed three-scene editorial grid (57/43 columns, 44/56 right rows), local 960×540 H.264 loops and posters. `globals.css` owns its 7px seams, 15px tile radii, navy contrast wash and 77% navy auth glass. The original skyline always remains underneath; any media failure, autoplay rejection or 15-second startup timeout returns the whole composition to that photograph. No videos mount on ≤900px, reduced motion, Save-Data, slow connections or ≤2 reported CPU cores. Hidden tabs pause playback; a visible Pause city scenes control supports manual pause. Hero entrance uses one short stagger, disabled for reduced motion. Login and all shared auth routes retain their existing forms and API flows; authenticated CityBackdrop is unchanged. Footage sources and compression recipe live in public/videos/README.md.

Authentication film correction (2026-10-23): user clarified that the clips must play sequentially in one full-screen scene, not a spatial mosaic. This supersedes the preceding mosaic paragraph. `CinematicCityBackground.tsx` now plays one local 1280×720, 24fps H.264 film: three real Atlanta night shots in sequence, with 0.8s dissolves and an edited loop boundary. Both desktop and mobile use the single player. No tile grid, seams or original skyline image remain in the auth background. Loading/reduced-motion/network/error fallback uses the new film's first frame. Pause, hidden-tab suspension and the existing form/branding remain.
