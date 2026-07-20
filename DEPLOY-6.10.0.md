# DEPLOY-6.10.0 — cumulative: 6.5.0 → 6.10.0 (SIX releases, one push)

**Everything PRE-BUILT. No build, no terminal.**
**ONE rules publish required** (introduced by 6.9.0's roster path):
Firebase console → Firestore → Rules → paste shipped `firestore.rules`
→ Publish. That single publish covers all six releases.

| Release | Headline |
|---|---|
| 6.5.0 | Building Bells |
| 6.6.0 | Period Identity |
| 6.7.0 | Personal Anchor Migration |
| 6.8.0 | The Shape Itself |
| 6.9.0 | Roster & Tags (**the rules change**) |
| 6.10.0 | The Calendar Wakes (day-of designation) |

App 6.10.0 · engine 1.7.0 · SW 1.16.0 (38 modules) · 60/60 tests.
Smoke tests in order: DEPLOY-6.5.0.md → … → DEPLOY-6.9.0.md → below.

## Smoke test for 6.10.0 (~5 minutes)

1. Hard-refresh. Footer/status: **app 6.10.0, engine 1.7.0, SW 1.16.0**.
2. Prereq: your account is on the roster (6.9.0 test).
3. Admin Zone → **Designate Schedules**. Date defaults to today. Type a
   tag in the filter (e.g. "8th") — the list narrows; clear it — full
   roster returns. Check yourself, pick a DIFFERENT schedule than
   you're viewing, click **Designate Checked People**.
4. You had manually chosen a schedule today, so expect the amber
   banner: "Today you are designated to X" — click **Follow** → the
   app switches and the banner clears.
5. Reopen the modal: the entry lists the schedule and your name;
   **Remove** it (leave real data clean), then switch yourself back.
6. If you have a reminder bell anchored on your normal base, repeat
   3–4 and note the banner's "(N of your reminder bells may not apply
   there)" line — that's I4.

## Promotion

Alpha only, as usual.
