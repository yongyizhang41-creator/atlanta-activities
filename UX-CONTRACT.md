# Product interaction ownership

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | native select in shared Field | English UI | native | browser keyboard |
| Date | lib/time.ts + ReminderDialog | America/New_York, explicit offset | custom date/time fields | DST unit tests |
| Form | components/ui.tsx Field + form handlers | server validation + inline errors | create/edit/auth | E2E |
| Scrollbar | app/globals.css | DESIGN.md | global, stable gutter | browser |
| Toast | components/ui.tsx Notice | role=status/alert | success/error/info | E2E |
| CRUD | lib/api.ts + FastAPI services | API errors and version checks | save/remove/move | API + E2E |
| Dialog | components/ui.tsx Modal (Radix) | accessible focus management | details/conflicts/reminder/delete | browser |

No table selection in this application. Session 401 redirects to login with local return path. Delete account requires explicit permanent-deletion dialog; removing a plan needs no destructive confirmation and cancels its pending reminder. Errors preserve input and provide retry. Filters cancel superseded fetches. Sensitive coordinates remain transient and are not added to URLs.
