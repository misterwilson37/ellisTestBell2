# DEPLOY — Ellis Web Bell (rolling; rewritten each release)

One deploy doc, kept OUTSIDE the zip, describing the current release only.
(Replaces the old per-version DEPLOY-6.x.md pile.) Full history is in CHANGELOG.md.

---

## Current state

- **LIVE: 6.20.0.**
- **Pending: 6.20.3** — carries the undeployed 6.20.1 + 6.20.2. Targets the
  "can't edit bell times" freeze, the false lunch overlap, and the update popup.

App 6.20.3 - engine 1.16.0 - service-worker 1.31.0 - old.html UNCHANGED (e56f1e4c...)

## Standing procedure (how every release ships)

No build, no terminal, no CLI — **GitHub web uploads only**, in ONE commit.

**Which files actually need to go up** (the deploy doc each release will spell
this out, but the rule is):

| File | When it needs re-uploading |
|---|---|
| `index.html` | every release |
| `service-worker.js` | every release (its `CACHE_VERSION` bump is what busts stale caches) |
| `src/js/` (whole folder) | whenever ANY module changed |
| `bell-engine.js` | ONLY when the engine version changed |
| `tailwind.css` | ONLY when it changed (new classes added) |
| `old.html` | ONLY when it changed — and cache-bust it on the TVs (`old.html?v=NNN`), it loads outside the service worker |
| `firestore.rules` | ONLY when rules changed (rare; publish in the Firebase console) |

**Why push the whole `src/js/` folder when only one module changed:** a partial
push can leave a stale module next to fresh ones (a module importing something an
old sibling no longer exports), which kills the app. Pushing the whole folder in
one commit makes that impossible. New modules MUST land (a missing one 404s the
app).

**After pushing:** cache-bust (append `?v=NNN`) and confirm the version in the
status modal before smoke-testing. Roll back by re-pushing the previous zip's
tree in one commit.

---

## This release: 6.20.3 (carries 6.20.1 + 6.20.2)

**1. The likely cause of "I can't change bell times."** The console line you sent —
`Delaying calculation: base and personal schedules have not both loaded` — comes
from a guard that makes the app render NOTHING until both the base and personal
schedule listeners have reported in. If either never reports, that latch stays
stuck forever: no error, no crash, the editor simply never updates and bell times
look unchangeable. You run a personal overlay, so you take that code path. Two
changes: a **watchdog** now force-opens the latch after 6 seconds and renders
anyway (a possibly-incomplete schedule beats a dead editor), and the warning now
names WHICH listener it is waiting on, so if it recurs the console says so.

**2. False overlap alarm on lunches** (6.20.2). Lunch waves run INSIDE 4th period;
nested periods are legitimate and are no longer reported as collisions. Real
partial overruns still are. The overlap check is also wrapped so it can never
break rendering or editing.

**3. Update popup removed** (6.20.1). Displays reload silently instead.

**Files to upload:** `index.html` (6.20.3), `service-worker.js` (1.31.0),
`src/js/` (whole folder), `bell-engine.js` (1.16.0).
**Not needed:** `tailwind.css`, `old.html` — both unchanged. No rules change.

**Smoke test:** load the app as admin on your usual personal overlay and try
changing a bell time. If it now works, that latch was the culprit. Watch the
console: if you see `[Watchdog] A schedule listener never reported (base=...,
personal=...)`, send me that line — it names the listener that is failing, which
is the remaining root cause to chase. Also confirm no red overlap banner on a
schedule with lunch inside 4th, and no update popup.
