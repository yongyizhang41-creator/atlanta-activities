# Premium motion implementation plan

Goal: implement the user's supplied motion specification directly, retaining all current activity, location, board and map behavior.

Architecture: Motion owns spring gestures and position-only list layout; a shared MotionConfig respects reduced motion. A decorative backdrop owns slow drift and spring-driven pointer parallax without React pointer-frame renders. MapLibre receives a separate one-feature highlight source, preserving clustering and camera gestures.

- [x] Add regression checks for hover lift without sibling displacement, keyboard access, reduced motion and linked map highlighting.
- [x] Add reusable spring/entrance variants and a shared motion provider for control feedback.
- [x] Animate cards and keyed day/entry layout with capped stagger and exit transitions; keep previous results while searches load.
- [x] Add backdrop, filter and timeline feedback; never transform map containers or drag handles.
- [x] Verify browser workflows, typecheck, unit tests, formatting and production build. Inspect desktop/mobile screenshots. No FPS claim without profiling.

Review focus: rapid filter changes and exits, focus leaving a card, reduced motion toggles, map style reloads with hover, pointer cancellation/disabled controls.


Verification: 15 Chrome E2E regressions passed (hover/no displacement, map link/focus, reduced motion, delayed week race, filter removal/reset, existing mobile/location/map flows); 26 unit tests passed; format:check, typecheck and production build passed. Independent scoped source review reported no important findings. No dedicated lint script exists in package.json; the configured formatter was run. Duplicate identical generated `.next/types/routes.d 2.ts` was moved out of the build cache before typecheck. No source typing workaround was introduced.
