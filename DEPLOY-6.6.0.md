# DEPLOY-6.6.0 — cumulative: Building Bells (6.5.0) + Period Identity (6.6.0)

**Everything ships PRE-BUILT. No build needed. No terminal needed.**
**No firestore.rules changes in either release — nothing to publish in
the Firebase console.**

This deploy is CUMULATIVE: neither 6.5.0 nor 6.6.0 has been pushed yet.
Push once, get both. (DEPLOY-6.5.0.md still exists for its detailed
Building Bells smoke test — run that first, then the short 6.6.0 test
below.)

## What 6.6.0 adds on top of 6.5.0

| File | Version | Why |
|---|---|---|
| index.html | 6.6.0 | "Assign Period IDs" panel in Admin Zone |
| src/js/00-header.js | (app 6.6.0) | APP_VERSION |
| src/js/05-preferences-cloud-sync.js | (app 6.6.0) | generatePeriodId |
| src/js/16-schedule-management.js | (app 6.6.0) | New periods born with ids |
| src/js/18-bell-crud-and-modals.js | (app 6.6.0) | Period birth + anchor stamping |
| src/js/31-period-identity.js | NEW | The backfill module |
| src/js/main.js | (app 6.6.0) | Imports module 31 |
| bell-engine.js | 1.5.0 | Identity-first period anchor resolution (+2 tests, 56 total) |
| service-worker.js | 1.13.0 | Caches module 31 (35 modules); busts old caches |

Nothing deleted. No CSS change in 6.6.0 (6.5.0's rebuilt tailwind.css
is included).

## Why you want this

Renaming a period used to orphan every reminder bell anchored to it
(anchors matched by period NAME). After the one-click backfill, anchors
follow the period's permanent id; renames become safe. This is also the
foundation the rest of Calendar v2 (transformations, alternate-base
days) stands on.

## Deploy

1. Push the whole tree to the **alpha** repo. Done.

## Smoke test for 6.6.0 (~3 minutes, after the 6.5.0 test)

1. Hard-refresh. Footer/status modal: **app 6.6.0, SW 1.13.0**.
2. Admin Zone → **Assign Period IDs** → expect "Done: stamped N period
   id(s) and M anchor(s) across K schedule(s)… Safe to run again."
3. Click it AGAIN → expect "Nothing to do — every period already has an
   id." (That's the idempotence proof.)
4. On a schedule with a reminder bell hanging off a period (e.g. a
   "2 minutes before end" bell): RENAME that period. The reminder bell
   should keep its correct time. (Before 6.6.0 this orphaned it.)
5. Rename it back. Check Edit History for a `period-identity-backfill`
   entry per schedule from step 2.

## Promotion

Alpha only, as usual. Beta when satisfied; building stays on 5.69.5
until the cumulative 6.x deploy.
