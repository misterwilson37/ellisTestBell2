// ===== 34-day-designation.js (NEW in 6.10.0 — design Layer 4, Verb A + I2) =====
// The fast DAY-OF designation modal: "this scope of people runs schedule X
// on date D." Writes v2 entries into config/schedule_calendar (covered by
// the existing config/{configId} rules — no rules change):
//   { days: { 'YYYY-MM-DD': { entries: [{scope:[uids], verb:'base',
//     scheduleId}] } } }
// Flat, dumb, explicit dates and ids (I3 — a future ES5 wall-clock reader
// walks this with zero cleverness). Clients resolve their OWN designation
// via engine 1.7.0 (module 20, revived).
//
// THE LAYER 3 INVARIANT, NOW IN ACTION for the first time: the people
// picker below filters the roster by tag or name, the admin EYEBALLS the
// filtered list and checks names, and the EXPLICIT checked uid list is
// what's stored in scope. Nothing ever resolves a tag at ring time.
//
// Verb B (transformation recipes on period edges) is the next slice; the
// entry shape already carries `verb` so recipes drop in additively.
//
// Module pattern: 29/30 self-contained; roster loaded once per modal open.

import { escapeHtml, toLocalDateString } from './00-header.js';
import { collection, doc, getDoc, getDocs, setDoc } from './01-firebase-imports.js';
import { safeLog } from './03-memory-management.js';
import { describeRecipe } from './20-schedule-calendar.js';
import { state } from './state.js';

const openBtn = document.getElementById('designation-open-btn');
const modal = document.getElementById('designation-modal');
const closeBtn = document.getElementById('designation-close');
const dateInput = document.getElementById('designation-date');
const entriesEl = document.getElementById('designation-entries');
const schedSelect = document.getElementById('designation-schedule');
const filterInput = document.getElementById('designation-filter');
const peopleEl = document.getElementById('designation-people');
const addBtn = document.getElementById('designation-add');
const statusEl = document.getElementById('designation-status');

// ===== v6.12.0: Verb B recipe-builder controls =====
const modeSelect = document.getElementById('designation-mode');
const baseGroup = document.getElementById('designation-base-group');
const transformGroup = document.getElementById('designation-transform-group');
const recipeTypeSelect = document.getElementById('designation-recipe-type');
const shiftFields = document.getElementById('designation-shift-fields');
const shortenFields = document.getElementById('designation-shorten-fields');
const shiftMinsInput = document.getElementById('designation-shift-mins');
const shiftDirSelect = document.getElementById('designation-shift-dir');
const shiftFromInput = document.getElementById('designation-shift-from');
const shiftUntilInput = document.getElementById('designation-shift-until');
const shortenAfterInput = document.getElementById('designation-shorten-after');
const shortenMinsInput = document.getElementById('designation-shorten-mins');
const shortenExtendInput = document.getElementById('designation-shorten-extend');
const periodNamesList = document.getElementById('designation-period-names');

let calDoc = null;   // working copy of the whole config doc
let roster = [];     // [{uid, displayName, tags}]

function calRef() {
    return doc(state.db, 'artifacts', state.appId, 'public', 'data', 'config', 'schedule_calendar');
}
function setStatus(msg, isError) {
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('hidden', !msg);
    statusEl.classList.toggle('text-red-600', !!isError);
    statusEl.classList.toggle('text-blue-600', !isError);
}
function nameOf(uid) {
    const r = roster.find((x) => x.uid === uid);
    return r ? r.displayName : uid.slice(0, 8) + '…';
}

// ===== v6.12.0: Verb B recipe builder =====
// The extend-target is keyed by period NAME (identity-first is a per-schedule
// concept; one recipe fits every schedule with a like-named period — engine
// contract). Suggest names from every admin schedule, deduped.
function populatePeriodNames() {
    if (!periodNamesList) return;
    const names = new Set();
    (state.allSchedules || []).forEach((s) => {
        (s.periods || []).forEach((p) => { if (p && p.name) names.add(p.name); });
    });
    periodNamesList.innerHTML = Array.from(names).sort().map((n) =>
        '<option value="' + escapeHtml(n) + '"></option>').join('');
}

function syncMode() {
    const transform = modeSelect && modeSelect.value === 'transform';
    if (baseGroup) baseGroup.classList.toggle('hidden', transform);
    if (transformGroup) transformGroup.classList.toggle('hidden', !transform);
    if (addBtn) addBtn.textContent = transform
        ? 'Apply Transformation to Checked People'
        : 'Designate Checked People';
    if (transform) syncRecipeType();
    setStatus('');
}

function syncRecipeType() {
    const t = recipeTypeSelect ? recipeTypeSelect.value : 'shift';
    if (shiftFields) shiftFields.classList.toggle('hidden', t !== 'shift');
    if (shortenFields) shortenFields.classList.toggle('hidden', t !== 'shorten');
}

// Read the transform fields into a recipe object, or null (+status) if invalid.
function buildRecipe() {
    const t = recipeTypeSelect ? recipeTypeSelect.value : 'shift';
    if (t === 'shift') {
        const mins = Math.abs(Math.trunc(Number(shiftMinsInput && shiftMinsInput.value)));
        if (!Number.isFinite(mins) || mins <= 0) {
            setStatus('Enter how many minutes to shift.', true); return null;
        }
        const sign = (shiftDirSelect && shiftDirSelect.value === 'earlier') ? -1 : 1;
        const recipe = { type: 'shift', offsetSeconds: sign * mins * 60 };
        const from = shiftFromInput && shiftFromInput.value;
        const until = shiftUntilInput && shiftUntilInput.value;
        if (from) recipe.from = from;
        if (until) recipe.until = until;
        return recipe;
    }
    if (t === 'shorten') {
        const after = shortenAfterInput && shortenAfterInput.value;
        const mins = Math.trunc(Number(shortenMinsInput && shortenMinsInput.value));
        if (!after) { setStatus('Enter the time after which periods shorten.', true); return null; }
        if (!Number.isFinite(mins) || mins <= 0) {
            setStatus('Enter minutes to shorten each period by.', true); return null;
        }
        const recipe = { type: 'shorten', after, perPeriodSeconds: mins * 60 };
        const extend = shortenExtendInput && shortenExtendInput.value.trim();
        if (extend) recipe.extendPeriodName = extend;
        return recipe;
    }
    setStatus('Unknown recipe type.', true);
    return null;
}

async function open() {
    modal.classList.remove('hidden');
    setStatus('');
    dateInput.value = toLocalDateString(new Date());
    schedSelect.innerHTML = state.allSchedules.map((s) =>
        '<option value="' + s.id + '">' + escapeHtml(s.name) + '</option>').join('');
    // v6.12.0: reset to base mode; fill the extend-period name suggestions
    if (modeSelect) modeSelect.value = 'base';
    if (recipeTypeSelect) recipeTypeSelect.value = 'shift';
    populatePeriodNames();
    syncMode();
    filterInput.value = '';
    entriesEl.innerHTML = '<p class="text-sm text-gray-500">Loading…</p>';
    peopleEl.innerHTML = '';
    try {
        const [calSnap, rosterSnap] = await Promise.all([
            getDoc(calRef()),
            getDocs(collection(state.db, 'artifacts', state.appId, 'public', 'data', 'roster')),
        ]);
        calDoc = calSnap.exists() ? calSnap.data() : {};
        roster = rosterSnap.docs.map((d) => ({ uid: d.id, ...d.data() }))
            .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
    } catch (e) {
        setStatus('Error loading: ' + (e && e.message), true);
        calDoc = calDoc || {};
    }
    renderEntries();
    renderPeople();
}

function entriesFor(dateStr) {
    return (calDoc && calDoc.days && calDoc.days[dateStr]
        && Array.isArray(calDoc.days[dateStr].entries))
        ? calDoc.days[dateStr].entries : [];
}

function renderEntries() {
    const dateStr = dateInput.value;
    const entries = entriesFor(dateStr);
    entriesEl.innerHTML = entries.length
        ? entries.map((e, i) => {
            const who = (e && Array.isArray(e.scope)) ? e.scope.map(nameOf).join(', ') : '';
            let label;
            if (e && e.verb === 'transform') {
                // v6.12.0: describeRecipe is shared with module 20's banner
                const summary = describeRecipe(e.recipe) || 'transformation';
                label = '<span class="font-medium text-amber-700">Transform:</span> '
                    + escapeHtml(summary);
            } else {
                const sched = state.allSchedules.find((s) => s.id === e.scheduleId);
                label = '<span class="font-medium">' + escapeHtml(sched ? sched.name : e.scheduleId) + '</span>';
            }
            return '<div class="flex items-center justify-between gap-3 border-b py-2">'
                + '<span class="text-sm">' + label
                + ' — ' + escapeHtml(who || '(nobody)') + '</span>'
                + '<button type="button" data-entry-del="' + i + '" class="text-red-600 text-xs hover:underline">Remove</button>'
                + '</div>';
        }).join('')
        : '<p class="text-sm text-gray-500">No designations for this date yet.</p>';
}

function renderPeople() {
    const q = (filterInput.value || '').trim().toLowerCase();
    const keepChecked = new Set(Array.from(
        peopleEl.querySelectorAll('input:checked')).map((cb) => cb.dataset.uid));
    const shown = roster.filter((r) => {
        if (!q) return true;
        if ((r.displayName || '').toLowerCase().includes(q)) return true;
        return (r.tags || []).some((t) => t.toLowerCase().includes(q));
    });
    peopleEl.innerHTML = shown.length
        ? shown.map((r, i) =>
            '<div class="flex items-center">'
            + '<input type="checkbox" id="desig-p-' + i + '" data-uid="' + r.uid + '"'
            + (keepChecked.has(r.uid) ? ' checked' : '')
            + ' class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">'
            + '<label for="desig-p-' + i + '" class="ml-2 block text-sm text-gray-900">'
            + escapeHtml(r.displayName || r.uid)
            + ((r.tags || []).length ? ' <span class="text-xs text-gray-500">('
                + escapeHtml(r.tags.join(', ')) + ')</span>' : '')
            + '</label></div>').join('')
        : '<p class="text-sm text-gray-500">No roster matches. (Roster & Tags in the Admin Zone manages the list; the filter matches names and tags.)</p>';
}

async function addEntry() {
    const dateStr = dateInput.value;
    const isTransform = modeSelect && modeSelect.value === 'transform';
    const scope = Array.from(peopleEl.querySelectorAll('input:checked'))
        .map((cb) => cb.dataset.uid);

    // v6.12.0: build the entry (base or transform) before touching the doc,
    // so a validation failure aborts with nothing written.
    let newEntry;
    if (isTransform) {
        if (!dateStr) { setStatus('Date is required.', true); return; }
        const recipe = buildRecipe();
        if (!recipe) return;               // buildRecipe set the status
        if (!scope.length) { setStatus('Check at least one person — transforms apply to explicit lists, never tags.', true); return; }
        newEntry = { scope, verb: 'transform', recipe };
    } else {
        const scheduleId = schedSelect.value;
        if (!dateStr || !scheduleId) { setStatus('Date and schedule are required.', true); return; }
        if (!scope.length) { setStatus('Check at least one person — designations are explicit lists, never tags.', true); return; }
        newEntry = { scope, verb: 'base', scheduleId };
    }

    addBtn.disabled = true;
    try {
        calDoc = calDoc || {};
        calDoc.days = calDoc.days || {};
        calDoc.days[dateStr] = calDoc.days[dateStr] || {};
        const entries = Array.isArray(calDoc.days[dateStr].entries)
            ? calDoc.days[dateStr].entries : [];

        let next;
        if (isTransform) {
            // Transforms COMPOSE (engine contract): a person can carry several
            // the same day, and can also be base-designated. No dedup — just
            // append. Remove is how you take one back.
            next = entries.slice();
            next.push(newEntry);
        } else {
            // V6.11.0: per-person last-write-wins for BASE. The resolver is
            // first-hit, so a stale earlier entry would keep winning after a
            // re-designation ("change my mind" silently broke). Strip each
            // newly-designated uid from every existing BASE entry first, drop
            // any entry whose scope empties, THEN append. Transform entries
            // are untouched — base and transform coexist for one person.
            const scopeSet = new Set(scope);
            next = [];
            for (const e of entries) {
                if (e && e.verb === 'base' && Array.isArray(e.scope)) {
                    const kept = e.scope.filter((u) => !scopeSet.has(u));
                    if (kept.length === 0) continue;        // whole entry emptied
                    if (kept.length !== e.scope.length) { next.push({ ...e, scope: kept }); continue; }
                }
                next.push(e);
            }
            next.push(newEntry);
        }
        calDoc.days[dateStr].entries = next;
        await setDoc(calRef(), { days: calDoc.days }, { merge: true });
        safeLog.log('[Designation] ' + dateStr + ': ' + scope.length + ' user(s) -> '
            + (isTransform ? 'transform ' + (newEntry.recipe && newEntry.recipe.type) : newEntry.scheduleId));
        setStatus(isTransform
            ? 'Saved — ' + scope.length + ' person/people carry this transformation. Their apps adjust at day change (or now).'
            : 'Saved — ' + scope.length + ' person/people designated. Their apps follow at day change (or now, unless they chose manually today — then they see the banner).');
        peopleEl.querySelectorAll('input:checked').forEach((cb) => { cb.checked = false; });
        renderEntries();
    } catch (e) {
        setStatus('Error saving: ' + (e && e.message), true);
    } finally {
        addBtn.disabled = false;
    }
}

async function removeEntry(index) {
    const dateStr = dateInput.value;
    const entries = entriesFor(dateStr).slice();
    if (index < 0 || index >= entries.length) return;
    entries.splice(index, 1);
    try {
        calDoc.days[dateStr].entries = entries;
        await setDoc(calRef(), { days: calDoc.days }, { merge: true });
        setStatus('Removed.');
        renderEntries();
    } catch (e) {
        setStatus('Error removing: ' + (e && e.message), true);
    }
}

if (openBtn) openBtn.addEventListener('click', open);
if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
if (addBtn) addBtn.addEventListener('click', addEntry);
if (modeSelect) modeSelect.addEventListener('change', syncMode);           // v6.12.0
if (recipeTypeSelect) recipeTypeSelect.addEventListener('change', syncRecipeType); // v6.12.0
if (dateInput) dateInput.addEventListener('change', renderEntries);
if (filterInput) filterInput.addEventListener('input', renderPeople);
if (entriesEl) entriesEl.addEventListener('click', (e) => {
    const t = e.target;
    if (t instanceof HTMLElement && t.dataset.entryDel !== undefined) {
        removeEntry(Number(t.dataset.entryDel));
    }
});

// ===== module exports (6.10.0) =====
// (none — self-wiring side-effect module, 28/29 pattern)
export {};
