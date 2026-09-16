# Ellis Web Bell — ROADMAP

**New in round 10 (6.23.0).** A roadmap already existed, but it lived in §7 of a
1,568-line HANDOFF.md, interleaved with closed bugs and reasoning trails. This
file is the short version: what is actually left, in plain English, on one page.

**HANDOFF.md remains the source of truth for *why*.** This file is the index.
When they disagree, HANDOFF.md wins — and fix this file.

**Last reviewed:** round 10, 2026-09, at 6.24.0.

---

## Where things stand right now

| | |
|---|---|
| Latest built version | **6.24.0** (app), **1.36.0** (service worker) |
| Live on alpha (owner's channel) | **through 6.20.4**, owner-confirmed |
| Built, battery-green, NOT deployed | **6.21.0, 6.22.0, 6.23.0, 6.24.0** — one push covers all four |
| Beta channel (CDC teacher) | 6.4.0 |
| Building channel (bells domain) | 5.69.5 backport |
| School channel (~50 faculty) | 5.79.x |
| Tests | 74/74, 41 modules |

**The deploy state above is BELIEF, not ground truth.** Confirm it with Jake at
the start of every round — the handoff has been wrong about this before.

---

## 1. Deploy what is already built

Four releases are sitting finished: duplicate-a-schedule (6.21.0), the
shift-rebase data fix (6.22.0), per-timer queue graphics (6.23.0), and
save-a-queue-as-a-quick-bell (6.24.0). One commit covers all four.

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
- **Dark-mode contrast sweep** of everything added since ~6.9.0. Three banners
  were checked, two were unreadable — newer surfaces were built with literal
  Tailwind colours while the app themes through `--theme-*` variables.

**A cold full-codebase audit is explicitly NOT recommended.** 41 modules of
theoretical findings has poor signal; every good find recently came from a real
symptom Jake hit.

---

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

## 5. Smaller / someday

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

## 6. Standing rules worth not rediscovering

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
