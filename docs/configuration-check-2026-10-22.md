# Local configuration check — 2026-10-22

No secret values are included in this report.

| Service | Verified result | Remaining work |
| --- | --- | --- |
| PostgreSQL / PostGIS | Database reachable; migration 0001; PostGIS 3.6 | Production hosting remains separate |
| Google OAuth | Correct callback, state, nonce and PKCE; database contains one linked Google identity | A new interactive sign-in was not performed during this check |
| OpenAI | Configured model accessible; real Responses request returned HTTP 200 and completed text | None for local use |
| MapTiler browser map | Style request accepted, HTTP 200 | None for local map rendering |
| MapTiler backend geocoding | Browser key rejects server requests without Referer, HTTP 403; dedicated backend key absent | Create a separate backend key and set MAPTILER_GEOCODING_KEY |
| Resend | Existing reminder has provider ID and sent timestamp; key is send-only | Current resend.dev sender is limited to the account owner; verify an owned domain for other recipients |
| Local runtime | API and login page HTTP 200; worker singleton lock held; heartbeat 19 seconds old at verification | Keep the local launcher running |

## Repairs verified

- Worker now holds a database advisory lock for its lifetime, preventing concurrent scheduler instances. Launcher respects an existing worker.
- Expired authentication email jobs are expired even after exhausting retries. The previously stale job is now expired.
- Backend geocoder uses the explicit user agent `AtlantaActivitiesGeocoder/0.1` for its own restricted key.
- Backend tests clear real provider credentials before importing application settings.
- Ruff checks passed. Backend regression suite: **39 passed** (two dependency deprecation warnings).
- Duplicate project worker processes were stopped and the repaired worker started successfully.

## Finish backend geocoding

The MapTiler creation form was prepared with name `Atlanta Activities Backend`, allowed user agent `AtlantaActivitiesGeocoder/0.1`, and allowed HTTP origin `?` (requests without Origin). The existing browser key must retain its localhost restriction.

Creating a persistent access credential requires the user's action or specific confirmation. After creating the key, run `make configure`, select `4`, press Enter to retain MAPTILER_KEY, then enter the new MAPTILER_GEOCODING_KEY privately. Restart the API and worker after saving. Do not paste keys into chat. A successful server geocoding check and a new ingestion run remain necessary after this step.

## Finish public email delivery

Verify a domain you own in Resend and add the required DNS records at its DNS provider. Set MAIL_FROM to an address on that verified domain using `make configure`, option `3`; retain the existing send-only API key. Domain ownership and DNS access are required. Provider acceptance of the previous reminder does not prove inbox delivery. No email was sent during this configuration check.

See [service setup](service-setup.zh-CN.md) for account setup. The application is verified locally; public deployment, HTTPS and production callback/domain configuration have not been verified.

## Superseding update: one-key MapTiler account

The user chose Nominatim for backend geocoding. The separate MapTiler key instructions above are superseded: no new key or upgrade is required. Existing browser key restrictions remain untouched. See integrations.md for public-service limits and configurable endpoint/cache. Only the public event venue lookup uses Nominatim; user location filtering stays separate.

Verification of replacement: backend suite 44 passed; Ruff passed; frontend TypeScript check passed after removing duplicate generated .next/types files. Real Nominatim lookup for Bobby Dodd Stadium returned (-84.3929589, 33.772476), and the repeated lookup used the persistent cache. A less precise Student Center query returned no reliable result and was rejected. Local worker was restarted with the replacement implementation. Existing MapTiler key and its provider restrictions were not modified.

End-to-end Downtown Atlanta ingestion using the replacement: published 2, omitted 1, error null. Missing reliable coordinates still prevent publication rather than producing a guessed map pin.
