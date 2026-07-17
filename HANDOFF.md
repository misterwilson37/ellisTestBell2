# HANDOFF.md — continuity document for Claude

**Audience:** a fresh Claude instance picking up this project cold (or the
teacher who maintains it, re-orienting after time away). Read this whole file
before writing any code. Last updated: **end of Stage 5 (status view) — the user's priority list 1-5 is COMPLETE. App version v5.79.0, 2026-07.**

---

## 1. What this project is

**Ellis Web Bell** — a real-time, synchronized school bell/schedule system for
a middle school that runs multiple simultaneous schedules. ~50 faculty use it
daily. Static site on GitHub Pages (CNAME in repo root), backed by Firebase
(anonymous + Google auth, Firestore, Storage). Built and maintained by one
teacher (a 6th–8th grade CS teacher); Claude has been doing a deep
cleanup-and-extend engagement since 2026-07.

Facts that shape design decisions — do not violate these:
- **Six different schedules are in simultaneous use** across the faculty on
  any given day; two teachers run ~9 schedules on classroom grids. There is
  NO single "today's schedule" for the whole school. (This is why the
  day-type calendar was parked — see §6.)
- **old.html serves iOS-9-era iPads/Kindle Fires** as wall clocks. It must
  stay ES5 (no arrow functions, template literals, const/let, spread). It
  reads Firestore via **unauthenticated REST** — firestore.rules has a
  deliberate carve-out (`personal_schedules` world-readable) that must never
  be "fixed."
- The user deploys by pushing to GitHub; there is no CI. Node builds run
  locally in `build/`.

## 2. CRITICAL: deployment state

**NOTHING from v5.70–v5.79 has shipped yet — TEN releases are pending in
one batch.** The user has explicitly accepted this risk ("we'll trust the
bugs to the next iteration"). If you are the next iteration and the rollout
has happened, your FIRST job is triage against ROLLOUT.md's smoke tests;
the verification battery (§5) tells you whether a reported bug is in the
code or in the deployment. The live site still runs the
pre-engagement code (~v5.69.4). The user is accumulating everything into ONE
batch rollout, executed via **ROLLOUT.md** (a living checklist — update it
every stage). Consequences:
- There are no live users on the new code; breaking changes between stages
  are still cheap. After the rollout happens, they are not — check with the
  user whether the rollout has occurred before assuming.
- The **source of truth is the user's copy of the project** — kept as
  `ellis-bell-vX.Y.Z-complete.zip` (the full site with directory structure;
  only the five signage/*.png crests are absent, since they were never
  uploaded). A fresh Claude session has an EMPTY container. The handoff
  procedure is: the user attaches the zip PLUS this file loose (so you can
  read it before extracting); you unzip into your workspace, run the §5
  battery, and REPORT WHAT STATE YOU FIND before changing anything. If you
  received loose files instead of a zip, directory placement is on you —
  reconstruct the tree exactly as §3 and the zip layout describe. After the
  GitHub rollout happens, the repo is the durable copy; ask the user for a
  fresh zip of it rather than fetching files piecemeal.

## 3. Architecture (current, v5.74.0)

Surfaces:
| File | What | Notes |
|---|---|---|
| `index.html` + `script.js` | Main teacher app (Firebase v11 ES modules) | **script.js is GENERATED** from `src/js/` (27 chunks; init chunk is numbered 99 so insertions never rename it) |
| `clock.html` v1.6.0 | 3x3 grid clock for Yodeck TVs (v9 compat) | Uses shared engine; refreshes data every 2 min |
| `old.html` v2 | ES5 iPad wall clock (unauthenticated REST) | Shift support + 5-min auto-refresh added |
| `dashboard-config.html` | Admin tool for signage config | Untouched by this engagement |
| `signage/` pages: dashboard v1.6.0, dashright v1.1.0, dashclock v1.1.0 | TV dashboard pages (v9 compat, live onSnapshot) | Share `signage/schedule-utils.js` (+ engine): relative bells resolved, shifts honored. dashboard's 3 config listeners are intentional branches |

Shared infrastructure:
- **`bell-engine.js` v1.2.0** — THE single implementation of pure
  time/schedule math (escapeHtml, timeToSeconds/secondsToTime,
  formatTime12Hour, getDateForBellTime, getBellId, findNextBellIn,
  findBellAfter, calculateRelativeBellTime, toLocalDateString,
  resolveCalendarSchedule, shiftTimeString, getActiveScheduleShiftSeconds).
  Loaded as a plain `<script>` by index.html and clock.html (pattern:
  firebase-config.js). Exports for Node. **Keep it pure** — no DOM, no
  Firebase, no app globals; dependencies come in as parameters.
- **`tests/`** — 51 node:test tests, zero deps (`bell-engine.test.mjs` +
  `schedule-utils.test.mjs`). `cd build && npm test`. Run after any change
  to bell-engine.js or signage/schedule-utils.js.
- **`build/`** — npm project. Scripts: `build` (css+js), `build:js`,
  `build:css` (self-verifying via verify-css.mjs), `check:js` (drift
  detection), `lint` (eslint no-undef only — it found 14 real bugs), `test`.
- **`firestore.rules`** — deploy manually via Firebase console (ROLLOUT §2).
- **service-worker.js v1.5.0**, cache `ellis-web-bell-v6`. Bump CACHE_NAME
  whenever CORE_ASSETS changes.

Firestore data model:
```
artifacts/{appId}/
  public/data/
    schedules/{id}         # shared schedules; admin-write; may carry
                           #   temporaryShift {seconds, date, setAt} (v5.74)
    share_codes/{code}     # create: own uid as ownerId; revoke: owner/admin
    config/dashboard       # signage page config
    config/schedule_calendar  # RESERVED by parked calendar feature (unused)
    admins/{uid}           # doc presence = admin
  users/{uid}/
    personal_schedules/{id}  # WORLD-READABLE on purpose (old.html REST)
    (everything else)        # owner-only
```

## 4. Engineering invariants & conventions (earned, not arbitrary)

1. **The Two Build Rules** (see `build/README-BUILD.md`): script.js and
   tailwind.css are generated; edit `src/js/` chunks / rerun the CSS build
   for never-before-used classes. `npm run check:js` detects drift.
2. **escapeHtml everything user-controlled going into innerHTML** (bell,
   period, schedule names; file names/nicknames; custom text). escapeHtml
   comes from the engine, destructured at the top of chunk 00.
3. **getBellId's quote-only escaping is intentional** (identity strings, not
   HTML). Changing it breaks stored mute/skip IDs. A unit test pins it.
4. **Blind-refactor discipline** (no browser here, 50 daily users there):
   every text edit via exact-match replacement with occurrence-count
   assertions; every chunk parse-checked; concatenation byte-verified;
   lint + tests after every stage; verify generated-file health (the CSS
   once came out EMPTY from a wrong-CWD build — that's why verify-css.mjs
   exists).
5. **Additive & backward-compatible**: features are dormant until an admin
   acts (shift: no temporaryShift field = no behavior change). Never change
   stored data shapes without a migration story.
6. **Emergency shift data-safety**: shifts apply to merged COPIES in
   resolveAllBellTimes; `localSchedulePeriods` stays pristine so edit modals
   never see (or save back) shifted times. Preserve this in any new surface.
7. **Version discipline**: every stage bumps APP_VERSION (chunk 00) +
   index.html `<title>`, adds a CHANGELOG.md entry (newest first, after the
   4-line header), updates ROLLOUT.md, and updates THIS FILE (§8 protocol).

## 5. Verification battery (run before and after every stage)

```
cd build && npm install        # once per fresh environment
node build-js.mjs --check      # script.js matches src/js/ build
node verify-css.mjs            # tailwind.css non-empty + sentinel classes
npm run lint                   # no-undef on script.js + bell-engine.js
npm test                       # 39+ engine tests
node --input-type=module --check < ../script.js
```
Also parse-check inline scripts of any edited HTML surface (extract
`<script>` bodies, `node --check` each; old.html must stay ES5 — eyeball for
arrows/template literals/const).

## 6. What's been done (details in CHANGELOG.md)

- **v5.70.0** — Security: real escapeHtml at ~60 innerHTML sites; tightened
  firestore.rules (scoped world-read to personal_schedules only; share codes
  owner-locked). Offline: SW precaches CDN assets. Changelog extracted.
- **v5.71.0** — Self-hosted compiled Tailwind (~30KB) replacing the Play CDN;
  `build/` tooling born; 442-class coverage verification.
- **v5.72.0** — bell-engine.js extracted (clock.html's copy had DIVERGED —
  missing V5.44.1 anchor logic); script.js split into chunks with byte-
  identical concatenation build; 15k-line IIFE removed (collision-checked);
  **14 latent ReferenceErrors found by lint and fixed**; tests born.
- **v5.73.0** — Day-type calendar built… then in
- **v5.74.0** — …**PARKED** (wrong model for six simultaneous schedules;
  hard-gated off, UI removed, resolver+tests kept; revival design sketch in
  `src/js/20-schedule-calendar.js` header). Emergency Schedule Shift shipped
  across main app + clock.html + old.html. clock.html got 2-min data refresh
  (was load-once — TVs never saw mid-day edits!); old.html got 5-min
  auto-refresh.
- **v5.79.0** — Status view: footer version number opens a diagnostics
  modal (SW version via GET_VERSION channel, drift, shift, schedule state,
  Copy Report). Chunk 25.
- **v5.78.0** — Notification backup ring: opt-in per-device toggle;
  hidden-tab-only; single ringBell() hook covers every ring path. Chunk 24.
- **v5.77.0** — Clock drift warning: hourly NTP-style measurement against
  Firestore server time; dismissible banner past 45s; math in engine v1.3.0
  with tests; warn-only by design. Init chunk renumbered to 99.
- **v5.76.0** — Signage full-depth: shared signage/schedule-utils.js;
  relative bells finally resolve on TVs (they showed raw stale times
  before); shifts honored via memoized effective periods; SW v1.6.0/cache
  v7; tests now 49 across two suites.
- **v5.75.0** — Edit audit log: append-only edit_log subcollection per
  shared schedule (create=admin, update/delete=NOBODY by rule); 16 mutation
  sites instrumented via fire-and-forget logScheduleEdit(); admin viewer
  modal. Chunk 22-audit-log.js; init is now chunk 23. Known limits recorded
  in the chunk header: batch ops log one summary entry to the active
  schedule (not per target); schedule deletions log under ghost parents;
  personal schedules deliberately unlogged; undo deferred but before/after
  captured where available.

## 7. Roadmap (user's priority order, set 2026-07)

**Stage 1 — Edit audit log. DONE (v5.75.0).** Built as designed. Follow-up
ideas parked in the chunk header: per-target logging for batch ops; a
central collection-group log (would make deleted-schedule entries reachable
and enable cross-schedule queries, but needs a collection-group rule +
index); one-click undo from before/after payloads. Note for undo: the
'edit-bell' entries capture name/time/sound but not visual/relative fields —
extend capture before building undo.

**Stage 2 — Signage pages. DONE (v5.76.0).** Built as designed:
schedule-utils.js (makeScheduleRecord / getEffectivePeriods memoized on
date|shift / getScheduleStatus + formatters), all three pages converted,
10 tests. Notable: dashright's "bit-for-bit identical" helper had already
drifted (cosmetic only — verified by normalized diff before centralizing);
the three dashboard config listeners are intentional mutually-exclusive
branches. Pages keep their historical isEnabled-period filter inside
makeScheduleRecord.

**Stage 3 — Clock drift warning. DONE (v5.77.0).** Built as designed;
warn-only (never auto-correct — documented in chunk 23's header), session
dismissal, silent failures with 15s timeout. `lastClockDriftMs` /
`lastClockDriftAt` globals are ready for Stage 5's status view. Probe doc:
users/{uid}/diagnostics/clock_drift (existing owner-only rules cover it).

**Stage 4 — Notification backup ring. DONE (v5.78.0).** DEVIATED from this
sketch on purpose: per-device localStorage instead of cloud-synced prefs
(Notification permission is per-browser; a synced toggle would lie), and
hidden-tab-only firing. One hook in ringBell() covers all ring paths; mutes
respected for free since callers gate before ringBell. Chunk 24's header
carries the full rationale.

**Stage 5 — Status/health view (v5.79.0).** In-app modal (tap the footer
version number): APP_VERSION, SW cache version (GET_VERSION message channel
already exists in service-worker.js), Firebase connectivity, active schedule
+ any active shift, clock drift (from Stage 3), schedule counts. Support
script: "open the app, tap the version number, read me the screen."

**Stage 6 — Housekeeping.** Self-host Tone.js; template-generate the 49
modals' shared chrome in index.html; automate CACHE_NAME bumping.

**Stage 7 — Stage-2 modularization.** Convert src/js chunks to true ES
modules one at a time (least-coupled first: 03-memory, 06-warnings,
07-kiosk); migrate raw console.log → safeLog per converted chunk. Background
work; never a big bang.

**Stage 27 (deliberately last) — Calendar v2.** Un-park the day-type
calendar with per-teacher groups (grade/role; the two grid teachers as
special cases). **Starts with a design conversation with the user about how
their six schedules map to faculty groups — do not start coding.** Resolver
+ tests already exist.

## 8. Protocol for updating this document

At the end of EVERY stage, update: the "Last updated" line (§ header),
§2 if deployment state changed, §3 versions, §6 (append the stage's
one-liner), §7 (mark stage done, fold in anything learned that changes later
stages), and §9 if new lessons emerged. Keep it under ~250 lines — this is a
map, not the territory; CHANGELOG.md carries detail.

## 9. Working with this user

- Teacher, technically strong, values momentum: "have-tos before want-tos,"
  batch rollout, minimal round-trips ("don't waste tokens — just continue").
  Will say "continue" and trust you; repay that with verification rigor, not
  speed.
- Wants docs that protect future-them: warning banners, ROLLOUT.md,
  README-BUILD.md, this file. Keep all of them current.
- Owns the Firebase console and the GitHub repo; you never have live access
  to either. Anything requiring the console goes in ROLLOUT.md.
- When a feature assumption might be wrong (see: calendar), they'll tell you
  — surface your assumptions early and loudly.
- Smoke tests are their last line of defense; write them concretely
  ("open X, click Y, expect Z"), never "verify it works."
- LESSON (post-Stage-5): docs written from the maintainer's perspective
  confused deploy night — the user read "edit the chunk, then build" as a
  deployment requirement. Generated files always ship PRE-BUILT; deploy
  docs must say "no build needed" in bold before anything mentions npm.
  Keep the deploy path terminal-free.
