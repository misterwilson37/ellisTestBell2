// ╔══════════════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT script.js DIRECTLY                       ║
// ║                                                                        ║
// ║  This file is BUILT by concatenating the files in src/js/ in the       ║
// ║  order defined in build/build-js.mjs. Edit those files, then run:      ║
// ║                                                                        ║
// ║      cd build && npm run build:js                                      ║
// ║                                                                        ║
// ║  and commit BOTH your src/js/ change and the regenerated script.js.    ║
// ║  Edits made here will be silently overwritten by the next build.       ║
// ║  Full workflow (this + the Tailwind rule): build/README-BUILD.md       ║
// ╚══════════════════════════════════════════════════════════════════════╝
const APP_VERSION = "5.79.0"
// Release history lives in CHANGELOG.md — add new version notes there, not here.
// (Extracted 2026-07: ~280 lines of V3–V5.69 notes moved out of this file.)

// ============================================================
// v5.72.0: SHARED BELL ENGINE
// The pure time/schedule math (formatting, time<->seconds, bell lookup,
// relative-bell resolution) lives in bell-engine.js, which index.html loads
// via a plain <script> tag BEFORE this module (same pattern as
// firebase-config.js). clock.html shares the SAME file — do not re-inline
// any of these functions here or there.
// Tests: `node --test tests/bell-engine.test.mjs` after any engine change.
// ============================================================
const {
    escapeHtml,
    getBellId,
    formatTime12Hour,
    timeToSeconds,
    secondsToTime,
    getDateForBellTime,
    toLocalDateString,
    shiftTimeString
} = window.BellEngine;

// (escapeHtml moved to bell-engine.js in v5.72.0)

