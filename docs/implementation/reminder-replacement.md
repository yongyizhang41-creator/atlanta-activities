# Latest reminder replaces previous schedule — 2026-10-23

User request: editing/saving a reminder replaces the previous reminder; send only
at the latest saved time. POST, PUT and PATCH now share a locked upsert. It updates
the unsent row and cancels other editable legacy rows in the same transaction.
Invalid inputs preserve the current schedule. Existing worker locking and fresh
row reads ensure queued old IDs cannot send at the old time. Delivery revisions
and retry state reset on replacement. Submitted/uncertain deliveries cannot be
recalled; replacement is rejected until resolved. Sent history remains immutable.

ReminderDialog uses PUT and hides sent/cancelled history. It retains Eastern/DST
validation and editable current schedule/cancel controls. UX-CONTRACT.md records
the revised behavior; no database schema change is needed.

Verified: Ruff; full backend suite 61 passed; frontend unit suite 24 passed;
TypeScript, Prettier and production build passed. Browser synthetic fixture
verified repeated preset replacement, custom edit, reload persistence, hidden
history and cancellation. Backend tests verified all save routes, legacy duplicate
cleanup, invalid input preservation and old-time/no-email versus latest-time/one
email using a test clock and mail sink. No real test emails sent.

Local launcher was restarted; API health passed so current API loads the change.
