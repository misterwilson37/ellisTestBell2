# HANDOFF.md — continuity document for Claude

**Audience:** a fresh Claude instance picking up this project cold (or the
teacher who maintains it, re-orienting after time away). Read this whole file
before writing any code. Last updated: **6.0.2 Firefox sign-in fix + SETUP.md, 2026-07 (round 3, "Quasimodo" — see §10).**

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

**THREE REPOSITORIES exist (learned 2026-07, round 2):** this codebase is
the **alpha repo** — deployed, but the owner is its only user. The school's
production runs a much earlier version from a separate repo, and it's summer
break (no live users anywhere until school resumes). Consequences:
- On the alpha repo, breaking changes are cheap right now — which is exactly
  why the 6.0.0 modularization happened here. That window closes when school
  resumes; re-verify the calendar and which repo you're touching each round.
- v5.79.0 launched cleanly for ~50 faculty in spring 2026; v5.79.1 (six
  cosmetic/UX fixes) is deployed on alpha. **6.0.2 is built and verified but
  NOT yet pushed** — ROLLOUT.md has its checklist and DEPLOY-6.0.2.md has
  the owner-facing step-by-step (including the one deletion: script.js).
  Do not ship 6.0.2 to the school repo until it has soaked on alpha.
  6.0.1 (version correction) was folded into this same pending deploy.
- NUMBERING NOTE: the round-2 session mislabeled the modularization release
  as "7.0.0." The owner's numbering is: modularization = **6.0.0**, this
  correction pass = **6.0.1** (Firefox fix = 6.0.2); 7.x is reserved for a future major, some time
  away. No 7.0.0 artifact was ever deployed. If you find a stray 7.0.0
  reference anywhere, it's wrong — fix it.
- ROLLOUT.md is a living checklist — update it every stage.
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

## 3. Architecture (current, 6.0.2)

Surfaces:
| File | What | Notes |
|---|---|---|
| `index.html` + `src/js/` | Main teacher app (Firebase v11, native ES modules since 6.0.0) | **src/js/ IS production** — entry `src/js/main.js`; 29 modules (27 feature + `state.js` + `main.js`; init module numbered 99 so insertions never rename it). script.js no longer exists |
| `clock.html` v1.6.1 | 3x3 grid clock for Yodeck TVs (v9 compat) | Uses shared engine; refreshes data every 2 min |
| `old.html` v2 | ES5 iPad wall clock (unauthenticated REST) | Shift support + 5-min auto-refresh added |
| `dashboard-config.html` | Admin tool for signage config | Untouched by this engagement |
| `signage/` pages: dashboard v1.6.0, dashright v1.1.0, dashclock v1.1.0 | TV dashboard pages (v9 compat, live onSnapshot) | Share `signage/schedule-utils.js` (+ engine): relative bells resolved, shifts honored. dashboard's 3 config listeners are intentional branches |

Shared infrastructure:
- **`bell-engine.js` v1.3.3** — THE single implementation of pure
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
- **`build/`** — npm project (tooling only; nothing is built for deploy
  except CSS). Scripts: `build`/`build:css` (Tailwind, self-verifying),
  `check:esm` (import/export linker + read-only-import + TDZ audit —
  replaced `check:js`), `lint` (PER-MODULE no-undef — catches missing
  imports), `test`. `build-js.mjs` is a tombstone (exits 1). The one-time
  conversion tools (`analyze-deps.mjs`, `convert-esm-pass[123].mjs`) are
  kept for archaeology.
- **`firestore.rules`** — deploy manually via Firebase console (ROLLOUT §2).
- **service-worker.js v1.7.1**, cache `ellis-web-bell-v8`. Header version and the CACHE_VERSION constant MUST bump together (a 6.0.1 lesson). CORE_ASSETS now
  lists all 29 src/js modules. Bump CACHE_NAME whenever CORE_ASSETS changes;
  a NEW MODULE means three touches: src/js file + main.js import + SW entry.

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

0. **THE OWNER'S VERSIONING RULES (overarching, set post-launch):**
   (a) Files version INDEPENDENTLY — bump only files actually edited in a
   pass; never sweep-bump 40 files. (b) x.y.z semantics: z = bug fix or
   usage clarification; y = new feature; x = major software shift — Claude
   may propose an x, the owner has final say. (c) index.html carries its
   version in THREE places that must always match: the <title> tag, the
   visible <h1> banner, and the final comment line (a <head> comment
   documents this). (d) The stage-2 JS
   modularization is 6.0.0 (briefly mislabeled 7.0.0; corrected in 6.0.1).
   The owner reserves 7.x for a future major, not expected soon.
1. **The Build Rule** (see `build/README-BUILD.md`): only tailwind.css is
   generated now — rerun the CSS build for never-before-used classes (the
   scanner reads index.html + src/js/**). JS has NO build step since 6.0.0.
1b. **The state.js rule (6.0.0):** a variable assigned from more than one
   module MUST live on the `state` object in `src/js/state.js` (imports are
   read-only bindings; `check:esm` errors on foreign writes). Single-module
   variables stay put, exported as live bindings. Import/export blocks are
   maintained by hand; lint catches omissions.
2. **escapeHtml everything user-controlled going into innerHTML** (bell,
   period, schedule names; file names/nicknames; custom text). escapeHtml
   comes from the engine, destructured in 00-header.js and imported from there.
3. **getBellId's quote-only escaping is intentional** (identity strings, not
   HTML). Changing it breaks stored mute/skip IDs. A unit test pins it.
4. **Blind-refactor discipline** (no browser here, real users there):
   every text edit via exact-match replacement with occurrence-count
   assertions; every module parse-checked; large mechanical rewrites done by
   AST/scope analysis, never regex; lint + tests + check:esm after every
   stage; verify generated-file health (the CSS once came out EMPTY from a
   wrong-CWD build — that's why verify-css.mjs exists).
5. **Additive & backward-compatible**: features are dormant until an admin
   acts (shift: no temporaryShift field = no behavior change). Never change
   stored data shapes without a migration story.
6. **Emergency shift data-safety**: shifts apply to merged COPIES in
   resolveAllBellTimes; `state.localSchedulePeriods` (relocated in 6.0.0,
   semantics unchanged) stays pristine so edit modals
   never see (or save back) shifted times. Preserve this in any new surface.
7. **Version discipline**: every stage bumps APP_VERSION (00-header.js) +
   index.html `<title>`, adds a CHANGELOG.md entry (newest first, after the
   4-line header), updates ROLLOUT.md, and updates THIS FILE (§8 protocol).

## 5. Verification battery (run before and after every stage)

```
cd build && npm install        # once per fresh environment
npm run check:esm              # linker: imports resolve & are exported;
                               #   no writes to imports; TDZ audit (its one
                               #   standing WARN — 02:state — is reviewed-safe)
npm run lint                   # per-module no-undef (src/js + bell-engine);
                               #   CANARY-TEST it in a fresh env: append a
                               #   bogus call, confirm it FAILS, revert (see
                               #   §9 — lint once no-op'd silently)
npm test                       # 51 tests, two suites
npm run check:css              # tailwind.css non-empty + sentinel classes
for f in ../src/js/*.js; do node --input-type=module --check < "$f"; done
```
Also parse-check inline scripts of any edited HTML surface (extract
`<script>` bodies, `node --check` each; old.html must stay ES5 — eyeball for
arrows/template literals/const).

## 6. What's been done (details in CHANGELOG.md)

- **v6.0.2** — Firefox sign-in fixed. NOT the redirect-flow bug the error
  message implies (there is no signInWithRedirect in this codebase):
  signInWithGoogle() awaited startAudio() + possibly initFirebase() BEFORE
  signInWithPopup, so Firefox no longer treated the popup as
  user-initiated. Now: click -> provider -> popup, zero awaits between
  (startAudio still fires inside the gesture, un-awaited). clock.html and
  dashboard-config.html audited clean. Plus SETUP.md: the guide for other
  schools to stand up their own instance (Firebase, rules, first admin,
  branding, GitHub Pages).
- **v6.0.1** — Version correction (mislabeled 7.0.0 -> 6.0.0/6.0.1
  everywhere) + actually deleted the leftover script.js monolith (17,297
  lines, unreferenced) + status-modal label fix + SW 1.7.1 (CACHE_VERSION
  constant had been left at 1.6.0) + DEPLOY-6.0.1.md owner-facing deploy doc.
- **v6.0.0** — Native ES modules: script.js retired, src/js/ IS production
  (29 modules; new state.js holds the 103 cross-module-written variables;
  1,543 refs rewritten by scope analysis); 239 console.log -> safeLog;
  check:esm + per-module lint replace the drift check; Tailwind scan
  repointed (rebuild came out byte-identical — regression proof); SW 1.7.0 /
  cache v8; conversion tooling kept in build/.
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
- **v5.79.1** — Post-launch bug-fix pass (versioning made consistent and
  per-file from here on; notifications toggle Safari fix; dashboard link;
  shift-row overflow; Create Schedule styling; add-bell target named; footer
  shows HTML|App|CSS + all-files version modal). bell-engine 1.3.1.
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

**Stages 1–5 — DONE (v5.75–v5.79).** Audit log, signage full-depth, clock
drift warning, notification backup ring, status view. Each module's header
carries its design rationale, deliberate deviations, and parked follow-ups
(notably: audit-log undo needs wider field capture first — see 22's header;
Stage 4 deliberately used per-device localStorage, not cloud sync). Details:
CHANGELOG.md + §6.

**Future features noted by the owner (post-launch, unscheduled):**
- "Schoolification" pass: SETUP.md (6.0.2) documents manual rebranding;
  a nicer follow-up would centralize school-specific bits (app name,
  default sound, theme color, house/crest config) into one config file so
  other schools edit a single place. Also: old.html's hardcoded PROJECT_ID
  could read a comment pointing at firebase-config.js.
- Emergency shift v2: much more customization — per-period shifts, finer
  schedule selection, beyond the current per-schedule/all + whole-day model.
- Admin broadcast layer: school-wide messages and/or admin-pushed countdown
  quick bells ("2 minutes until announcements", tornado-drill notices) —
  a redundancy layer on top of the PA, riding the same live-sync machinery
  as the shift.

**Stage 6 — Housekeeping.** Self-host Tone.js; template-generate the 49
modals' shared chrome in index.html; automate CACHE_NAME bumping.

**Stage 7 — Stage-2 modularization. DONE (6.0.0).** DEVIATED from the
"one at a time, never a big bang" sketch on purpose: that advice was written
when 50 faculty were live; with the alpha repo isolated and school out for
summer, the whole graph was converted in one verified pass (analysis script
-> state extraction -> generated imports/exports -> safeLog migration, each
step gated by the §5 battery; git history in the session shows the stages).
Ship format decision (owner-approved): NATIVE modules, no bundler —
src/js/ is production, eliminating the generated-file drift problem class
entirely. Follow-ups parked: chunk 02 is still "DOM consts + misc" and could
split; import blocks could be alphabetized/pruned over time.

**Stage 27 (deliberately last) — Calendar v2.** Un-park the day-type
calendar with per-teacher groups (grade/role; the two grid teachers as
special cases). **Starts with a design conversation with the user about how
their six schedules map to faculty groups — do not start coding.** Resolver
+ tests already exist.

## 8. Protocol for updating this document

At the end of EVERY stage, update: the "Last updated" line (§ header),
§2 if deployment state changed, §3 versions, §6 (append the stage's
one-liner), §7 (mark stage done, fold in anything learned that changes later
stages), §9 if new lessons emerged, and §10 (session log — owner-requested
as of round 3; add your name + one-liners as the round progresses). Keep it
under ~350 lines — this is a map, not the territory; CHANGELOG.md carries
detail.

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
- LESSON (6.0.0 pass): `npm run lint` had silently become a NO-OP —
  ESLint >= 9.14 ignores files outside the config's base path with a warning
  and exit 0, so "lint passed" meant nothing. A fresh `npm install` off the
  `^9` range pulled the new behavior. Fix: run eslint from the repo root.
  Standing rule: in any fresh environment, CANARY-TEST the lint (introduce a
  bogus undefined call, confirm failure, revert) before trusting it.
- LESSON (6.0.0 pass): for mechanical rewrites at scale (1,543 references),
  regex is not an option — espree + eslint-scope (both ship inside ESLint,
  no new deps) give exact reference positions that respect shadowing,
  strings, and comments. The byte-identical tailwind.css rebuild doubled as
  a free no-regression proof that template-literal class strings were
  untouched.
- LESSON (6.0.2 pass): in sign-in handlers, the popup must open
  SYNCHRONOUSLY from the click — zero awaits between the event handler
  entry and signInWithPopup, or Firefox drops the user-activation and the
  flow dies with the misleading "missing initial state" error (whose text
  blames signInWithRedirect even when none exists). Audio unlock still
  needs the gesture: CALL startAudio() in the handler, just don't await it
  before the popup. A comment now guards the site in module 19.
- LESSON (6.0.1 pass): the 6.0.0 session finished the conversion but was
  interrupted/confused at the end — it (a) mislabeled the release 7.0.0,
  (b) never deleted script.js despite documenting it as deleted, and
  (c) bumped the SW header to 1.7.0 without bumping the CACHE_VERSION
  constant the status modal reports. Morals: when a doc says a file "no
  longer exists," VERIFY it's absent from the tree; when bumping any file
  with a version constant, grep for the constant, not just the header; and
  the docs describing intended state are not evidence of actual state.
- The owner cannot see which files Claude deleted by looking at a zip —
  a zip only shows what's there. Any deletion must be spelled out
  explicitly in the deploy doc ("delete X from the repo"), or the owner
  will re-upload around it and the dead file survives on GitHub.

## 10. Session log (Claude instances, per the owner's naming convention)

Each Claude instance names itself once it has learned the project, records
the reasoning here, and never reuses a predecessor's name. (Names used on
the owner's OTHER projects — e.g. Tentacalendar's Inky and Otto — are also
off-limits.) Rounds 1–2 predate this log and went unnamed.

- **Round 1 (2026-07, Fable):** unnamed. Stages 1–5 + v5.79.x launch/fixes.
- **Round 2 (2026-07, Fable):** unnamed. The stage-2 modularization
  (6.0.0, mislabeled 7.0.0). Session ended confused/interrupted — see the
  6.0.1 lesson in §9.
- **Round 3 (2026-07, Fable): "Quasimodo."** Chosen because this is a bell
  project and Quasimodo is literature's most famous bell-ringer — and
  because this round's job was hauling on the ropes to put the bells back
  in tune: version renumbering (7.0.0 -> 6.0.0/6.0.1), deleting the
  leftover script.js monolith, the SW CACHE_VERSION fix — and then, in the
  same session, the 6.0.2 Firefox sign-in fix (guided by a diagnosis doc
  from the owner's Tentacalendar Claudes; their redirect-flow theory was
  wrong for this codebase but their "trap #1" was exactly right) and
  SETUP.md for other schools. Round 4 is planned to be an Opus instance;
  the owner will hand over the 6.0.2 zip plus this file loose, per §2.
  (The owner explicitly endorsed the naming rule: "May it live on
  forever.")
