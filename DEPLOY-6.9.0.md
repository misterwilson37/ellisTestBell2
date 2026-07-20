# DEPLOY-6.9.0 — cumulative: 6.5.0 → 6.9.0 (FIVE releases, one push)

**Everything ships PRE-BUILT. No build needed. No terminal needed.**

## ⚠️ THIS ONE HAS A RULES CHANGE — one extra step

6.9.0 adds the roster path, so **firestore.rules must be published**:

1. Firebase console → Firestore Database → Rules
2. Paste the full contents of the shipped `firestore.rules`
3. Publish

(6.5.0–6.8.0 needed no rules change; this is the only publish for all
five releases. Deploy the site files and publish rules in either order
— the roster UI simply errors politely until rules are live.)

## What's in the push

| Release | Headline |
|---|---|
| 6.5.0 | Building Bells (intercom anchors + one-edit propagation) |
| 6.6.0 | Period Identity (periodId + backfill; renames stop breaking reminder bells) |
| 6.7.0 | Personal Anchor Migration (silent stamping + review modal) |
| 6.8.0 | The Shape Itself (edge primitive extracted; anchors record home base) |
| 6.9.0 | Roster & Tags (My Tags self-serve + admin roster; capability grants) |

App 6.9.0 · engine 1.6.0 · SW 1.15.0 (37 modules) · 58/58 tests ·
tailwind.css rebuilt. Smoke tests in order: DEPLOY-6.5.0.md →
6.6.0 → 6.7.0 → 6.8.0 → below.

## Smoke test for 6.9.0 (~4 minutes)

1. Hard-refresh. Footer/status: **app 6.9.0, SW 1.15.0**.
2. Header: click **My Tags** → add "8th" via the suggestion chip →
   expect "Saved." Reload, reopen — the tag persists.
3. Admin Zone → **Manage Roster & Tags** → your row shows the grey
   "8th" chip. Type a capability in your row's amber field, press
   Enter → amber chip appears. Reopen My Tags: capability shows
   read-only under "Capabilities."
4. Click **Seed from presence** → expect a count of added users (or
   "already on the roster"). Wall clocks must NOT appear.
5. The rules test that matters: as a NON-admin account, My Tags →
   add/remove tags works; there is no capability input anywhere on the
   self-serve surface — and even a hand-crafted write touching
   capabilities would be rejected by rules.

## Promotion

Alpha only, as usual.
