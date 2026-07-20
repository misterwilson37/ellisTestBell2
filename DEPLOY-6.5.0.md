# DEPLOY-6.5.0 — Building Bells + clock presence

**Everything in this zip ships PRE-BUILT. No build needed. No terminal
needed.** (tailwind.css was already rebuilt to include one new class.)

**No firestore.rules changes this time — nothing to publish in the
Firebase console.** The new `config/building_bells` doc is covered by
the existing `config/{configId}` rule (read: everyone, write: admins)
that has been live since before 6.x.

## What changed

| File | Version | Why |
|---|---|---|
| index.html | 6.5.0 | Admin panel + Building Bells modal + anchor select |
| src/js/00-header.js | (app 6.5.0) | APP_VERSION + engine export |
| src/js/16-schedule-management.js | (app 6.5.0) | Anchor save path + field-preservation fix |
| src/js/30-building-bells.js | NEW | The feature module |
| src/js/main.js | (app 6.5.0) | Imports module 30 |
| bell-engine.js | 1.4.0 | Pure propagation function (+3 tests, 54 total) |
| service-worker.js | 1.12.0 | Caches module 30; busts old caches |
| clock.html | 1.7.0 | Presence heartbeat (anonymous TVs only) |
| tailwind.css | (rebuilt) | One new class (hover:underline) |
| build/verify-esm.mjs | (tooling) | Two reviewed TDZ entries whitelisted |
| CHANGELOG.md, HANDOFF.md, DESIGN-CALENDAR-V2.md | docs | Updated |

Nothing was deleted in this release.

## Deploy

1. Push the whole tree to the **alpha** repo (usual flow). That's it.

## Smoke test (alpha, ~5 minutes)

1. Hard-refresh. Footer/status modal should say **app 6.5.0, SW
   1.12.0**. (SW may need one extra refresh to take over.)
2. Admin Zone → **Manage Building Bells** → add a bell, e.g.
   "End of 3rd" at your real intercom time. Expect it listed with
   "no anchored bells yet."
3. Click **Anchor matching…** on it. Expect a checkbox list of every
   shared bell at exactly that time across your 8 schedules (or the
   "no unanchored bells at exactly…" note if times don't match to the
   second). Confirm → the row's anchor count updates.
4. Edit the building bell's time by +30 seconds. Expect the
   confirmation listing per-schedule counts. Apply → open one of those
   schedules and verify the bell moved. Check the Edit History viewer
   for `building-bell-propagate` entries.
5. Edit one anchored schedule bell directly (admin, "override for all"
   checked). Expect the new **Anchor to building bell** dropdown showing
   its anchor. Change the time to something different and save — expect
   "Changes saved. Building-bell anchor … removed — times no longer
   match."
6. Move the building bell's time back to the real intercom time
   (repeat step 4 in reverse) so alpha data ends the test correct.
7. clock.html on a TV (or a private/incognito window so the session is
   anonymous): let it sit 1 minute, then check the Usage Dashboard —
   expect a **Wall clock** row, version "clock 1.7.0", running your
   grid's schedule labels. A signed-in browser deliberately does NOT
   add a clock row (it already reports via the app).
8. old.html untouched this release — no test needed.

## Promotion

Alpha only for now, per the channel flow (alpha → beta → building).
Beta gets 6.5.0 whenever you're satisfied on alpha; the building stays
on the 5.69.5 backport until the 6.x cumulative deploy.
