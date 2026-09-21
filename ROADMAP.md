# Ellis Web Bell — ROADMAP

**New in round 10.** A roadmap already existed, but it lived in §7 of a
1,568-line HANDOFF.md, interleaved with closed bugs and reasoning trails. This
file is the short version: what is actually left, in plain English, on one page.

**HANDOFF.md remains the source of truth for *why*.** This file is the index.
When they disagree, HANDOFF.md wins — and fix this file.

**Last reviewed:** round 11, 2026-09, at **6.26.0**.

---

## Where things stand right now

| | |
|---|---|
| Latest built version | **6.26.0** (app), **1.42.0** (service worker), **v1.3.0** (right-column.js) |
| Live on alpha (owner's channel) | **everything he has received** — he pushes on receipt, so 6.25.1 as of round 11's start |
| Outgoing delta (round 11) | **6.26.0** — signage right column extracted + birthday ticker |
| Beta channel (CDC teacher) | 6.4.0 |
| Building channel (bells domain) | 5.69.5 backport |
| School channel (~50 faculty) | 5.79.x |
| Tests | 118/118, 41 modules |

**The table above is what this round BUILT, not a guess about his channel.**
He posts everything on receipt, so whatever zip you were handed is live — see
§1. Do not open a round by asking him about deploy state.

---

## 1. Deploy what is already built

**CLOSED ROUND 11 — there is nothing to deploy that he does not already have.**
The owner's rule, stated plainly: *"I post everything up every single time you
send it to me."* On a GitHub Pages site the repo IS the deployment, so the zip
handed to a new session is, by construction, what is live.

**DO NOT OPEN A ROUND BY ASKING ABOUT DEPLOY STATE.** Rounds 9, 10 and 11 all
did, and the answer was the same every time. The old advice here ("treat it as
stale and ask him first") produced the very ritual it was trying to prevent: the
handoff can only ever describe the moment before the session's last push, so it
will always look like there is a gap, and there never is. Record the OUTGOING
delta — what this round is sending him — and let him push it as he always does.

**Rule that has bitten this project before:** replace the ENTIRE `src/js/` tree
plus the changed root files in ONE commit. A partial push leaves new modules
beside stale ones, and because this is a native ES-module graph, one stale
module kills the whole app before sign-in even wires. Then cache-bust a spot
check (`?v=2` on a file URL) before smoke testing — GitHub Pages holds a ~10
minute CDN cache.

---

## 2. Carrying fixes to the other channels

Jake is the only admin on every channel, which is why none of this is urgent —
but it is also why he is the only person who can trigger the bad one.

- **The shift-rebase bug (6.22.0) EXISTS on the school channel.** `temporaryShift`
  landed in v5.74, so 5.79.x has it. An admin saving any shared bell during an
  emergency shift permanently rebases that bell for ~50 people. This is the one
  with teeth. Building (5.69.5) predates the shift and is safe.
- **The bell-time fix (6.20.4)** — deliberately downgraded. It only ever bit
  administrative edits and Jake now knows to tick the confirm. Port it AFTER the
  rebase fix, not before: a swallowed edit is an annoyance, a rebased bell is
  wrong data for the whole faculty.

Both channels predate modularization (a `script.js` monolith, no `src/js/`), so
these are PORTS, not copies. Confirm which repo is which before touching
anything, and get a fresh zip of the target.

---

## 3. Two bounded sweeps (round 8's recommendation, still open)

Earned by real symptoms, not theory — both are finite and mechanically checkable.

- **Affordance sweep.** For every interactive control: does its enabled state
  match who can actually use it, and does its label match what saving actually
  does? The edit-bell modal alone produced four defects of this kind and the
  rename button a fifth. That is a pattern.
- **Known instance, found round 11 and NOT fixed:** `dashboard-config.html`
  deletes null keys from its payload then calls `set(..., {merge: true})`, so
  clearing a field and pressing Save does not clear the stored value — the
  button does not do what its label says. 6.26.0 fixed this for the four new
  ticker fields only (`FieldValue.delete()` when blank); `canvaUrl` and
  `housesSheetCsvUrl` still behave the old way. Textbook affordance defect,
  left for the sweep rather than widened mid-release.
- **Dark-mode contrast sweep** of everything added since ~6.9.0. Three banners
  were checked, two were unreadable — newer surfaces were built with literal
  Tailwind colours while the app themes through `--theme-*` variables.

**A cold full-codebase audit is explicitly NOT recommended.** 41 modules of
theoretical findings has poor signal; every good find recently came from a real
symptom Jake hit.

---

## 3b. OPEN BUG (round 10, unreproduced): stale quick-bell icon on the display

**Symptom, owner-reported:** after running a saved queue, the visual cue fell
back to the icon of a quick bell and STAYED there the rest of the afternoon.
Gone the next day — consistent with a page reload clearing it, since nothing here
is persisted.

**Confirmed structural defect** in module 10's visual priority block, Priority 3:

```js
if (!visualHtml && millisToQuickBell < Infinity) {
```

The gate tests only that a quick-bell end time EXISTS, never that it is still in
the FUTURE. So any non-null `state.quickBellEndTime` — including one whose
moment passed hours ago — outranks the period visual (Priority 4) forever. It
then falls into the `else` branch and matches a saved quick bell by NAME
(`b.name === activeTimerLabel`) and paints that bell's icon. That is precisely
the reported shape: one quick bell's icon, pinned, until reload.

**What was ruled out** (read in full, round 10): the queue's own teardown is
clean. `advanceQueue()` calls `cancelQueue()` after the final repeat, and
`cancelQueue()` nulls `queueTimerEndTime`, `quickBellEndTime`, the queue array,
the index and the repeat counter. 6.24.0's `startSavedQueue()` sets the same
fields `startQueue()` does. So the queue is most likely the TRIGGER (it made him
look at the display) rather than the cause; the stale end time probably came
from an ordinary quick bell earlier that day.

**What is NOT yet explained:** how `quickBellEndTime` survived past its own ring,
since module 10 line ~344 nulls it when it fires. Prime suspect is the ring's
cooldown gate — `nowTimestamp - state.lastRingTimestamp > RING_COOLDOWN` sits in
front of BOTH the ring and the clear, so a quick bell expiring inside a schedule
bell's cooldown is skipped; it should be retried on a later tick, which needs
confirming. A backgrounded or slept tab is the other candidate. **Do not fix
blind.** Get the diagnostic below first.

**Diagnostic (owner runs this on the display machine the moment it recurs, in
the browser console — it needs no reload, and a reload destroys the evidence):**

```js
copy(JSON.stringify({
  qbEnd: state.quickBellEndTime, qbName: state.quickBellEndTime?.bellName,
  overdueSec: state.quickBellEndTime
    ? Math.round((Date.now() - new Date(state.quickBellEndTime).getTime())/1000) : null,
  queueActive: state.queueActive, queueEnd: state.queueTimerEndTime,
  queueLen: state.quickBellQueue?.length, queueIdx: state.queueIndex,
  lastRing: state.lastRingTimestamp, now: Date.now(),
  visualSource: document.getElementById('visual-cue-source')?.textContent
}, null, 2))
```

`qbEnd` non-null with a positive `overdueSec` and `queueActive: false` confirms
the diagnosis above, and `qbName` names the bell whose icon is stuck.

**The fix, once confirmed,** is to require the end time to be in the future
(`millisToQuickBell > 0`) rather than merely present, and to clear a quick-bell
end time that is overdue past a sane threshold whether or not it managed to ring.
Guard both, not just one: the defect is that a past-tense end time is treated as
an active one, and clearing is currently the ring handler's side effect.

---

## 3c. clock.html per-bell audio — DONE in clock.html v1.8.0

Resolved in round 10. `playBellSound()` took no argument and played one
configured sound for every bell, so a bell set silent still rang there. It now
takes the bell's own sound, honours `[SILENT]`, and falls back to the configured
sound for any bell that has none — so untouched setups sound exactly as before.
The owner's reasoning: if someone has gone to the trouble of choosing sounds per
bell on the website, the clock should play what they chose, silence included.

**His requested per-schedule-line silent toggle ALREADY EXISTS** and was left
alone: the per-column 🔔 checkbox on the setup screen is all-or-nothing audio per
schedule line and already defaults to OFF, so a refresh stays quiet. Inverting it
to a "silent" checkbox would flip the meaning of a control that is already
encoded in every saved URL (`a1`…`a9`), silently turning audio ON for anyone
holding an old link. Not worth it for a relabel.

## 4. Calendar v2 — what is left

The big architecture (see DESIGN-CALENDAR-V2.md) is mostly built. Remaining:

- **Alternate-base transfer** with the "I4" drop-notice. This is the last piece
  of Layer 2 and it needs Layer 4's designation mechanism, so it is the natural
  first bite of Layer 4 rather than a standalone job.
- **Rotation-cycle generator** — a repeating sequence of schedules across days,
  in two modes: *slip-forward* (a holiday does not consume a rotation slot) and
  *calendar-locked* (cycle position pinned to the date regardless of skips).
  **Ellis does not rotate** — the feeder high school does. This is
  for-other-schools work, deliberately deferred. When built it is another
  generator in module 35's repeat panel. The skip-day math is the only genuinely
  new logic; make it a pure, tested engine helper.
- **"Reclaim a period" refinements** (shipped 6.18.0, two known gaps):
  (a) a relative bell anchored INTO the reclaimed period orphans to fallback for
  the day — it should fold onto a surviving neighbour instead, which needs
  anchor re-homing and is fiddly;
  (b) optional checkboxes to choose WHICH surviving periods absorb the freed
  time (v1 spreads it across all of them).
  Neither blocks use.

---

## 5. Birthday ticker on the signage right column — DONE in 6.26.0

Built round 11, together with the right-column extraction it depended on. The
column now reads **ticker 12% / four house cards 71% / clock 17%** — the clock
moved from top to bottom and all three previous bands were squeezed, rather than
the scoreboard absorbing the new band alone.

**The duplication question answered itself:** `dashboard.html` and
`dashright.html` had already drifted five ways (see CHANGELOG 6.26.0 and the
header of `right-column.css`, which lists all five with reasoning). The column
now lives once, in `signage/right-column.css` + `signage/right-column.js`,
following the `schedule-utils.js` pattern — plain `<script>`, one global, no
build step. `dashright.html` is now a mount point and a few lines of Firebase
wiring. Both new files are in CORE_ASSETS and in module 25's version report.

**Data comes from four published Sheet CSVs** (students, faculty, closures, holidays), set in `dashboard-config.html`
v1.3.0 — birthdays, closures, wacky holidays, plus a fallback line. The
privacy design is load-bearing and should not be "simplified": the published
birthday tab is a formula over a PRIVATE roster tab, so the public URL carries
no birth year, no full last name and no student who opted out. Nothing about
students touches Firestore.

**Open, and the only thing outstanding:** the owner still owes an enrolment
figure so `MAX_LEAD_SCHOOL_DAYS` (currently 15) can be sized. It governs how
many summer birthdays land per day in the last three weeks of school — fine at
~600 students, wants raising to 20 at ~1200. One constant in right-column.js.

**Watch for, first time he fills in the closure sheet:** it takes the WEEKDAYS
school is shut and glues the flanking weekends on itself. Listing the weekends
as well, or listing a break as Wed–Sun when it really starts Monday, produces a
different set of closure runs and therefore different lead windows. A unit test
pins both readings so the behaviour is at least visible.

## 5b. "Add a temp bell" inside the bell modal — SPEC SETTLED, NOT BUILT

The modal it lives in shipped in 6.25.0. **Every open question below was
answered by the owner in round 10; this is a build ticket, not a design one.**

**The governing principle, in his words:** a teacher needs the option of
something specific ("going to the auditorium at 8:23") or general ("midway
through the class"). **Default to the general, make every field editable, and
both cases are covered.** Quick path and detailed path, one control.

**Storage — DECIDED.** Mirror the skip set exactly: a today-only local overlay
that self-clears overnight, keyed like `getSkipKey()`
(`HH:MM:SS|name|YYYY-MM-DD`), device-specific, in localStorage. **Do NOT write
into `personalBells`** — that persists forever and syncs. Skips already work
this way (V5.55.6 deliberately removed mute state from cloud sync), so a temp
bell is the same shape of thing and should share the mechanism.

**Defaults when inserted between two bells — ALL EDITABLE:**

| Field | Default | Editable how |
|---|---|---|
| Time | Midpoint of the gap | Normal time input, fully editable |
| Name | Auto ("Temp bell" or similar) | Text field |
| Sound | The app's standard default | The normal sound dropdown |
| Graphic | Text cue from the NAME, or `!` if none set | The normal visual dropdown |

**Graphic must NOT inherit from the previous bell** — the owner's reason is
good: two identical graphics back to back is confusing rather than helpful. Use
the existing `[CUSTOM_TEXT] <text>|<bg>|<fg>` format the quick bells already use.

**One wrinkle to handle, not yet put to the owner:** the auto-name and the
name-derived graphic collide. If the bell auto-names to "Temp bell", a
text-from-name graphic reads "Tem", which is noise. Treat an auto-generated name
as "not set" for graphic purposes so it shows `!` until the teacher types a real
name, then track what they type. Flag this to him if it turns out to be awkward.

**Removal — DECIDED (low stakes).** Reuse the row's existing Skip button if that
is simpler. He noted that "skip" reads oddly for something already temporary,
but the end result is identical and he does not mind. One button per row wins.

**Implementation note carried from 6.25.0:** the modal's list is capped at five
and re-rendered on every toggle, with the rendered array stashed so an index
resolves to the same bell that was drawn. Any insert MUST re-render through that
same path or the indices drift.

## 6. Smaller / someday

- **Admin broadcast layer** — school-wide messages and admin-pushed countdown
  quick bells ("2 minutes until announcements", tornado-drill notices) as a
  redundancy layer over the PA, riding the same live-sync machinery as the
  shift. **Note:** 6.23.0 + 6.24.0 built a local, single-machine version of this
  idea — a named, saved, multi-step countdown. If the broadcast layer is ever
  built, the saved queue's `steps` array (`{durationSeconds, sound, visual}`) is
  the obvious payload to push, and quick bells already carry an
  `alwaysBroadcast` flag.
- **Schoolification leftovers** — still manual by design: `manifest.json`
  (static JSON), replacing the sound FILE, clock.html's one label, signage
  crests. Clock/signage config consumption would be a small additive pass.
- **Wall-clock precompute for Verb B** — app clients resolve transforms at
  runtime; the ES5 REST clocks still cannot. (The wall-clock FEED arc itself is
  complete as of 6.20.0.)
- **Module 02 split** — reviewed twice, re-parked twice. It is 370 uniform DOM
  consts, not a grab-bag; splitting churns every module's imports for cosmetic
  gain. Revisit only if something else forces it.
- **Audit-log undo** — deferred; needs wider before/after field capture first.
- **Whitelist-mapper audit (NEW, round 10).** Module 15 rebuilds each custom
  quick bell field-by-field from a whitelist, which silently dropped
  `alwaysBroadcast` from V5.65.0 until 6.24.0 fixed it. That is a *class* of
  bug, not a one-off: anywhere a Firestore document is reconstructed by naming
  its fields, a later feature that adds a field and forgets the mapper produces
  a setting that works until you refresh. Worth one pass over the other snapshot
  handlers. Small, mechanical, and it pairs naturally with the affordance sweep
  in §3 — both are "does this control actually do what it says".

---

## 7. Standing rules worth not rediscovering

- Deploy the whole `src/js/` tree in one commit (see §1).
- Alpha -> beta -> building is the promotion order.
- All three channels **share one Firestore**, so every schema change must be
  additive-only. This is invariant zero.
- `old.html` must stay ES5 — no arrows, template literals, `const`/`let`,
  spread. It serves iOS-9-era iPads over unauthenticated REST, and the
  `personal_schedules` world-readable carve-out in firestore.rules is deliberate
  and must never be "fixed".
- Keep `bell-engine.js` pure: no DOM, no Firebase, no app globals.
- Run the §5 battery before AND after every stage.
- Jake has no CLI on his school Mac. Anything requiring a local build — most
  importantly a Tailwind CSS rebuild — has to be done for him and shipped built.
  Check new Tailwind classes against the existing `tailwind.css` before using
  them.
