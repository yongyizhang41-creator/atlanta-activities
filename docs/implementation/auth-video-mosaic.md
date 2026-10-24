# Authentication continuous film — corrected 2026-10-23

User clarified: one full-screen video with Atlanta clips playing sequentially,
not three spatial tiles. The original skyline photograph is removed from auth.

CinematicCityBackground.tsx plays one local 1280×720, 24fps, ~3.8 MiB H.264 film.
Three normal-direction shots join with 0.8s dissolves, including the loop seam.
Only one decoder is needed on desktop and mobile. Its first frame supplies
loading/error/reduced-motion/constrained-connection fallback. Pause/resume,
hidden-tab pause, hero motion and existing auth API flows are preserved.
Footage provenance and edit recipe: apps/web/public/videos/README.md.

Chrome checks: actual one-player playback, duration >20s, pause/resume, validation,
Google destination, mobile playback/no overflow, reduced-motion and failure
fallback, reactive motion preference and all shared auth routes. Seven checks
passed. Vitest: 24 passed. TypeScript, formatting and production build are checked
with the current change. Static premium audit: no findings.

The earlier full business E2E attempt failed at fixture login (incorrect email
or password); full authenticated business-flow regression remains unverified.
