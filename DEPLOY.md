# DEPLOY — Ellis Web Bell (rolling; rewritten each release)

One deploy doc, kept OUTSIDE the zip, describing the current release only.
Full history is in CHANGELOG.md.

---

## Current state

- **LIVE: 6.20.4** (owner deployed; bell-time fix confirmed working).
- **Pending: 6.21.0** — Duplicate Schedule, plus the greyed rename button and
  the unreadable dark-mode banners.

App 6.21.0 · engine 1.16.0 (UNCHANGED) · service-worker 1.33.0 · old.html UNCHANGED (e56f1e4c…)

---

## UPLOAD THIS RELEASE

| File | Upload? |
|---|---|
| `index.html` | **YES** (6.21.0) |
| `service-worker.js` | **YES** (1.33.0 — the cache bump is what busts stale copies) |
| `src/js/` (whole folder) | **YES** |
| `styles.css` | **YES** (hand-written; carries the dark-mode banner fix) |
| `CHANGELOG.md`, `HANDOFF.md`, `DEPLOY.md` | **YES** |
| `bell-engine.js` | no — unchanged |
| `tailwind.css` | no — no new classes; the two used were already compiled |
| `old.html` | no — unchanged |
| `firestore.rules` | no — **no rules change** |
| `README.md`, `SETUP.md`, `ROLLOUT.md` | no — unchanged |

Everything in ONE commit. Push the whole `src/js/` folder even though only two
modules changed: a partial push can leave a stale module importing something a
fresh sibling no longer exports, which kills the whole ES-module graph.

**After pushing:** cache-bust (append `?v=NNN`) and confirm 6.20.4 in the status
modal (tap the footer version) BEFORE smoke-testing. Roll back by re-pushing the
previous zip's tree in one commit.

---

## What's in 6.21.0

**1. Duplicate Selected Schedule.** New button in the Admin Zone, next to
Rename. Copies the selected shared schedule's periods into a brand-new
schedule, asks you to name it (defaults to "<name> (copy)"), and switches you
to it. Shows up in the audit log as `duplicate-schedule`.

One thing worth knowing: the copy's bells get **new internal IDs**. They have
to. Those IDs are how each teacher's personal nicknames, sounds and muted bells
are stored — if the copy reused the original's, someone's muted bell on "Lunch
A" would silently turn up muted on "Lunch B" too. Building-bell anchors ARE
carried over (the copy shares those intercom moments). Any emergency shift on
the original is NOT carried over, since a shift is about one day.

**2. "Rename Schedule" works for admins on shared schedules.** It was greyed
out because that button only ever handled *personal* schedules, despite its
label. It now renames whatever is selected, routing to the same admin rename
flow the Admin Zone button and the little pencil already use.

**3. Banners readable in dark mode.** The "N people have signed in but have no
tags yet" banner was dark-navy text on a dark background. So was the schedule
designation banner — you just hadn't seen it fire yet. Both were built with
fixed light-mode colours instead of the app's theme variables. Fixed in
`styles.css`; light mode looks exactly as before.

---

## Smoke test

1. **Duplicate.** Admin on a shared schedule → Admin Zone → Duplicate Selected
   Schedule → accept the default name. Expect: new schedule created, selected,
   with the same periods and bells. Check a relative bell still sits the right
   distance from its anchor.
2. **Overrides do not bleed.** On the ORIGINAL, mute a bell or give it a
   personal nickname. Switch to the duplicate. Expect: that bell is untouched
   there.
3. **Rename.** Admin on a shared schedule → the "Rename Schedule" button in the
   schedule panel should be enabled and should rename the shared schedule.
4. **Dark mode.** Switch to dark. Expect the untagged-teachers banner to be
   clearly readable. Light mode should look unchanged.
5. Re-confirm 6.20.4 still behaves: changing a bell time without ticking the box
   refuses with a message rather than silently closing.
