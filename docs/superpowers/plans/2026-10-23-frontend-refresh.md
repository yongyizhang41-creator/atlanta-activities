# Day and Night Frontend Refresh Implementation Plan

**Goal:** Restyle ATL / Out as a clear city activity guide with persistent, user-selectable Day and Night themes.
**Architecture:** Semantic CSS tokens and one shared theme utility/component, bootstrapped before paint. Existing React screens and API behavior remain authoritative. Map appearance follows the theme with selection/location/view state preserved.
**Tech Stack:** Existing Next.js 16, React 19, TypeScript, plain CSS, MapLibre, Radix, Vitest and Playwright.
**Spec:** docs/superpowers/specs/2026-10-23-frontend-refresh-design.md

- [x] Theme: write failing preference/initialization tests, add lib/theme.ts and components/ThemeToggle.tsx, integrate layout/bootstrap, Shell and AuthPage. Verify persistence and two-mode switching.
- [x] Visual identity: update semantic Day/Night tokens and existing rules in globals.css, presentation in EventCard/Explore/Board/AuthPage and DESIGN.md. Preserve handlers and accessible labels; unify fields/dialogs/plan status states.
- [x] Maps: validate OpenFreeMap Dark endpoint, follow theme without losing filters, viewport, pins, coverage or current location. Verify in browser.
- [x] Verification: unit/type/format tests, existing Chrome journeys, two-theme responsive screenshots of auth/Explore/plans/reminder dialog and overflow/contrast checks. Clean labelled test fixtures afterward. Document verification and any limitations.
