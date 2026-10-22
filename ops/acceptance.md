# Acceptance record — 2026-10-22

| Requirement | Code / evidence | Status |
|---|---|---|
| Email/password login, verification, reset | auth/router.py; auth tests; Chrome auth flow | Local behavior tested; real emails need provider |
| Google login and identity linking | Authlib OIDC routes, account UI | Implemented; real credentials required |
| This/next week and category filters | events queries, PostGIS tests, Chrome journey | Tested |
| Activities with location, radius and drawn area | PostGIS query, polygon validation, MapLibre | Rendered map plus polygon/clear/manual-radius interactions passed in real Chrome |
| Maybe/Going board, drag and button alternatives | Board.tsx, plans service, Chrome journey | Button moves, pointer drag and persistence passed in Chrome; keyboard buttons available |
| Schedule conflict detection + confirm | plans tests + independent concurrent DB test, Chrome | Tested |
| One reminder and strict valid time | reminder API, DST UI tests, Chrome settings | Tested locally |
| Email delivery, cancellation, retry | delivery and uncertainty tests, independent code review | Local contract tested; real provider send required |
| Activity AI conversation | chat ownership/config tests, Chrome missing-provider behavior | Implemented; real model reply required |
| Automatic collection, no Admin | GT/arena/venue adapters, source run logs | Arena: 7 and MBS: 1 real event; Downtown and campus need geocoding |
| English responsive UI | build, desktop/mobile screenshots, browser tests | Tested; see runtime checks |
| Public deployment | Compose, Dockerfiles, backup/restore, CI, setup guide | Prepared; backup/restore scripts verified locally; Docker/cloud/TLS deployment unverified |

External-provider absence is not counted as a passing integration. The site is not yet publicly launched and full source coverage is not yet achieved. See integrations.md and service-setup.zh-CN.md for the concrete remaining setup.

Final verification: 35 backend tests (including no-email configuration regression), 3 frontend time tests, 4 real-Chrome journeys, TypeScript and production build, zero-finding strict UI audit. Independent review findings fixed. Public launch remains pending provider configuration and deployment validation.
