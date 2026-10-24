# Weekend Journal Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline.

**Goal:** Add the approved weekend-journal presentation while preserving all activity actions.
**Architecture:** A pure Eastern-date grouping helper and an Explore-owned day-group component reuse EventCard through an optional journal variant. CSS remains the sole token owner; map stays mounted and sticky.
**Tech Stack:** Next.js, React, Luxon, CSS, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-23-weekend-journal-design.md

## Global constraints
Preserve existing uncommitted changes, APIs, business rules, Day/Night and mobile views. No dependencies. Counts are loaded counts when pagination is incomplete.

## Review focus
UTC-midnight/DST grouping; pagination merging; cancellation and unknown end times; narrow/short viewports; compact EventCard reuse outside Explore.

### Task 1: Grouping
- [x] Write and observe failing tests for Eastern calendar boundaries, DST repeated hours, stable input order and merging appended same-day pages.
- [x] Implement dayGroups.ts; use source event ordering and avoid mutation.

### Task 2: Journal presentation
- [x] Add EventDayGroups and EventCard journal variant; preserve details and plan actions, full date semantics and end-time information.
- [x] Widen desktop area, add date headings/time-axis, stone filter panel, keyboard-focus/hover treatment and viewport-sized sticky map. Update DESIGN.md.

### Task 3: Verify
- [x] Add browser checks for day groups, pagination, mobile, themes and semantic dates/actions. Run existing magazine browser coverage.
- [x] Run unit/type/format/build and strict audit; review changes and save screenshots. Record any full-suite fixture blocker accurately.

## Evidence and decisions
- Grouping tests first failed on the missing module, then passed for Eastern midnight, DST repeated hour and appended pages. Preserve server order rather than introducing new sorting rules.
- `npm test`: 21/21 passed. New browser journal coverage + existing magazine coverage: 6/6 passed. Fixtures exercise partial/complete counts, one date heading per day, unknown end, cancellation, Maybe request body, details, narrow view and themes. Existing map canvas/draft tests also passed.
- Formatting check, production build (including TypeScript), and strict premium audit passed. Independent focused review reported no actionable regressions.
- Standalone typecheck initially hit existing duplicate generated `.next/types/routes.d 2.ts`; production build regenerated those types successfully.
- Screenshots: `.local/journal-desktop-day.png`, `.local/journal-desktop-night.png`, `.local/journal-mobile-night.png`. These use labelled synthetic event data and minimal map style.
- Reused existing workspace to preserve ongoing uncommitted work. No dependencies, API changes, business-rule changes or commits.

- Final short-desktop check: map height fits a 400px-high viewport and canvas remains usable; desktop canvas min-height is released while mobile fixed-height behavior remains.
- Standalone typecheck passed after regenerated build types.
- Full legacy E2E attempted again: first reminder journey timed out waiting for its named fixture activity; 16 remaining tests stopped by max-failures=1. New journal coverage is independent of that stale live fixture. No full-suite success claimed.
