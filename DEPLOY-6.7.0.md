# DEPLOY-6.7.0 — cumulative: Building Bells (6.5.0) + Period Identity (6.6.0) + Personal Anchor Migration (6.7.0)

**Everything ships PRE-BUILT. No build needed. No terminal needed.**
**No firestore.rules changes in ANY of the three releases — nothing to
publish in the Firebase console.**

Cumulative deploy: none of 6.5.0/6.6.0/6.7.0 has been pushed yet. Push
once, get all three. Run the smoke tests in order: DEPLOY-6.5.0.md
(Building Bells), DEPLOY-6.6.0.md (Period Identity), then the short
6.7.0 test below.

## What 6.7.0 adds on top of 6.6.0

| File | Version | Why |
|---|---|---|
| index.html | 6.7.0 | Anchor-review banner + review modal |
| src/js/00-header.js | (app 6.7.0) | APP_VERSION |
| src/js/18-bell-crud-and-modals.js | (app 6.7.0) | Multi-add relative bells stamp parentPeriodId |
| src/js/19-visual-cues-and-files.js | (app 6.7.0) | Personal periods + import converter stamp periodId at birth |
| src/js/32-personal-anchor-migration.js | NEW | Client-side migration + review modal |
| src/js/main.js | (app 6.7.0) | Imports module 32 |
| service-worker.js | 1.14.0 | Caches module 32 (36 modules); busts old caches |

Nothing deleted. No CSS, rules, or engine changes in 6.7.0.

## Why you want this

6.6.0's backfill couldn't touch personal schedules (owner-only
writable by rule). Now each user's own reminder bells silently upgrade
to identity anchors the first time they use the app with a migrated
base schedule — and in the rare case a period name is duplicated, they
get a gentle amber banner and a review modal instead of a guess.

## Smoke test for 6.7.0 (~4 minutes, after the 6.5.0/6.6.0 tests)

1. Hard-refresh. Footer/status modal: **app 6.7.0, SW 1.14.0**.
2. Make sure you ran **Assign Period IDs** (6.6.0 test) first.
3. On an account with a personal schedule containing a reminder bell
   (period-anchored relative bell): open the app, wait ~30 seconds
   with the tab visible. Check the browser console for
   "Anchor migration (silent): stamped N reminder bell(s)…".
4. Reload — the message should NOT repeat (nothing left to stamp).
5. Rename the base period that reminder bell hangs off. The bell keeps
   its time (that's the whole point).
6. Ambiguity path (optional, contrived): create a second period with
   the SAME NAME as one your reminder bell anchors to, reload, wait
   ~30s — expect the amber "needs a quick review" banner; click
   Review, see the bell with a period picker (time spans shown),
   choose "Decide later" and Close; dismiss the banner. Delete the
   duplicate period afterwards.
7. Multi-add a relative bell ("add to multiple periods") — it should
   work exactly as before; new ones now carry identity invisibly.

## Promotion

Alpha only, as usual.
