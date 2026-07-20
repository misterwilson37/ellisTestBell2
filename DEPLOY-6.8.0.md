# DEPLOY-6.8.0 — cumulative: 6.5.0 + 6.6.0 + 6.7.0 + 6.8.0

**Everything ships PRE-BUILT. No build needed. No terminal needed.**
**No firestore.rules changes in ANY of the four releases — nothing to
publish in the Firebase console.**

Cumulative: none of 6.5.0–6.8.0 has been pushed. Push once, get all
four. Smoke tests in order: DEPLOY-6.5.0.md, DEPLOY-6.6.0.md,
DEPLOY-6.7.0.md, then the short 6.8.0 test below.

## What 6.8.0 adds on top of 6.7.0

| File | Version | Why |
|---|---|---|
| index.html | 6.8.0 | Version bump only |
| src/js/00-header.js | (app 6.8.0) | APP_VERSION + primitive export |
| src/js/16-schedule-management.js | (app 6.8.0) | Edit-modal prefill routed through engine primitive (kills a drift bug) |
| src/js/18-bell-crud-and-modals.js | (app 6.8.0) | Anchors record home base |
| src/js/31-period-identity.js | (app 6.8.0) | Backfill records home base |
| src/js/32-personal-anchor-migration.js | (app 6.8.0) | Migration records home base |
| bell-engine.js | 1.6.0 | findPeriodEdgeAnchorBell extracted (+2 tests, 58 total) |

service-worker.js UNCHANGED (1.14.0 — network-first, no asset-list
change). Nothing deleted. No CSS, rules, or new modules.

## Smoke test for 6.8.0 (~2 minutes)

1. Hard-refresh. Footer/status modal: **app 6.8.0**, engine **1.6.0**
   (status modal shows the engine version), SW still 1.14.0.
2. Open the edit modal on an existing period-anchored reminder bell —
   the anchor dropdown should preselect the same bell it always did
   (the extraction is behavior-identical; 58/58 tests).
3. Add a new relative bell anchored to a period start/end, then check
   it rings/displays at the right time. (Invisibly, it now records
   which base schedule it was anchored against.)
4. Everything else: no user-visible changes — this release is
   foundation for Calendar v2's transformation recipes.

## Promotion

Alpha only, as usual.
