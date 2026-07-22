// ===== 37-overlap-warning.js (NEW in 6.16.0) =====
// The "you're cutting into 4th" heads-up. When an admin is editing and a
// period's last bell runs PAST the next period's first bell, this surfaces a
// dismissible warning naming the overrun. It is strictly READ-ONLY: it looks
// at state.calculatedPeriodsList (the same periods the list renders) after
// each recalc and never touches a bell — the interactive shrink/spread fix
// that MOVES bells is a deliberately separate, later slice (that path is the
// sacred live-edit code; detection earns its trust first).
//
// Admin-only: the warning only shows when body.admin-mode is on. A dismiss
// hides it until the next distinct set of overruns appears (so fixing one and
// re-breaking it still re-warns, but an unchanged warning stays dismissed).

import { escapeHtml } from './00-header.js';
import { state } from './state.js';

const banner = document.getElementById('overlap-warning-banner');
const textEl = document.getElementById('overlap-warning-text');
const dismissBtn = document.getElementById('overlap-warning-dismiss');

let dismissedSignature = null; // the overrun set the user last dismissed

function hide() { if (banner) banner.classList.add('hidden'); }

function fmt(t) {
    return window.BellEngine && window.BellEngine.formatTime12Hour
        ? window.BellEngine.formatTime12Hour(t, true) : t;
}

function refreshOverlapWarning() {
    if (!banner || !textEl) return;
    // Only nag admins who are actually editing.
    if (!document.body.classList.contains('admin-mode')) { hide(); return; }
    const engine = window.BellEngine;
    if (!engine || !engine.detectPeriodOverlaps) { hide(); return; }

    const overlaps = engine.detectPeriodOverlaps(state.calculatedPeriodsList || []);
    if (!overlaps.length) { dismissedSignature = null; hide(); return; }

    const signature = overlaps.map((o) =>
        o.name + '>' + o.nextName + '@' + o.overlapSeconds).join('|');
    if (signature === dismissedSignature) { hide(); return; } // unchanged & dismissed

    const one = overlaps[0];
    const mins = Math.round(one.overlapSeconds / 60);
    let msg = '⚠ ' + escapeHtml(one.name) + ' ends ' + escapeHtml(fmt(one.endsAt))
        + ', but ' + escapeHtml(one.nextName) + ' begins ' + escapeHtml(fmt(one.startsAt))
        + ' — a ' + mins + '-minute overlap.';
    if (overlaps.length > 1) msg += ' (+' + (overlaps.length - 1) + ' more)';
    textEl.textContent = ''; // reset
    textEl.innerHTML = msg;
    banner.dataset.signature = signature;
    banner.classList.remove('hidden');
}

if (dismissBtn) dismissBtn.addEventListener('click', () => {
    dismissedSignature = banner ? (banner.dataset.signature || null) : null;
    hide();
});

// ===== module exports (6.16.0) =====
// recalculateAndRenderAll (module 18) calls this after each render.
export { refreshOverlapWarning };
