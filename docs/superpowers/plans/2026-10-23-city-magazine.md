# City Magazine Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement inline.

**Goal:** Deliver the approved Atlanta lifestyle-guide design without changing business behavior.
**Architecture:** Extend Explore markup and global visual tokens. Keep ActivityMap mounted through mobile view changes, and reuse existing event cards, controls and theme owner.
**Tech Stack:** Next.js 16, React 19, CSS, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-23-city-magazine-design.md

## Global Constraints
English UI; Eastern dates; existing APIs, authentication, plans, reminders and geographic filters remain authoritative. Preserve uncommitted work. No dependencies, fabricated event photos or business-rule changes.

## Review Focus
Mobile hidden-map resizing and geometry persistence; list access during map filtering; long titles; theme contrast; empty/loading/error states.

### Task 1: Responsive discovery view
- [x] Add a browser regression using public-page mocked fixture APIs: assert mobile list/map switch, category/week persistence, desktop simultaneous map/list, keyboard controls and no overflow.
- [x] Run and observe missing-view-control failure.
- [x] Add Explore list/map toggle and mounted view containers; selecting a geo mode opens map on mobile without resetting filters.
- [x] Verify browser regression.

### Task 2: Magazine presentation
- [x] Add bounded city hero, clean canvas, warm Day/navy Night tokens, wider list and secondary map. Scope hero styles to Explore and photo to auth story.
- [x] Preserve event semantics and actions; clamp excerpts to two lines. Update DESIGN.md.
- [x] Inspect desktop/mobile Day/Night and sibling auth/plans screens; check errors/empty/loading and keyboard use.

### Task 3: Verification
- [x] Run format, unit, typecheck, production build, strict premium audit and configured browser suite. Record external blockers precisely.
- [x] Review changes against pre-task snapshots, address actionable findings and save screenshots.

## Verification evidence
- `npm test`: 18/18 passed.
- `npm run typecheck`, `npm run format:check`, `npm run build`: passed.
- `npm run e2e -- magazine.spec.ts`: 5/5 passed, with synthetic fixture API routes; covers 320/390/768/1024/1440 widths, keyboard detail access, Day/Night, map canvas identity, polygon drafts and error/empty recovery.
- Strict premium audit: no findings (`.local/magazine-ui-audit.json`).
- Independent review found hidden shared errors in mobile Map view. Reproduced the failing visibility assertion, moved Notice/Retry above switched views, and reran green. Follow-up review found no remaining actionable issues.
- Existing full E2E suite attempted with max-failures=1: reminder journey timed out searching for the required activity; remaining suite was not run. A follow-up read-only login probe confirmed the existing fixture account returns HTTP 401. This task does not claim full live backend regression coverage.
- Screenshots saved in `.local/magazine-*.png`; fixture map has a minimal test style rather than external cartography.

## Decisions and scope
Preserved concurrent Locate me work and all other pre-existing uncommitted changes. Kept existing repository checkout because it contains the active uncommitted application. No dependencies, commits, backend behavior or delivery settings changed. MapLibre's installed source confirms native container ResizeObserver; no duplicate resize handler was added. Shared error placement is a presentation correction required by the mobile view split.
