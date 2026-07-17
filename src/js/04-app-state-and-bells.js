let currentVisualPeriodName = null; // NEW in 4.50: Tracks the period currently displayed by the visual cue.
let currentVisualKey = null; // NEW: Tracks the actual visual being displayed (e.g., "after:bellId", "before:bellId", "period:name")

// NEW V5.05: Global Mute State and UI Sync
let isGlobalMuted = false;

function updateMuteButtonsUI() {
const btnMuteAll = document.getElementById('mute-all-list-btn');
const btnUnmuteAll = document.getElementById('unmute-all-list-btn');

if (btnMuteAll) {
    // Toggle visual state of Mute All button
    btnMuteAll.classList.remove('bg-gray-200', 'bg-red-600', 'text-gray-700', 'text-white');
    btnMuteAll.classList.add(isGlobalMuted ? 'bg-red-600' : 'bg-gray-200');
    btnMuteAll.classList.add(isGlobalMuted ? 'text-white' : 'text-gray-700');
    btnMuteAll.textContent = isGlobalMuted ? 'GLOBALLY MUTED' : 'Mute All';
}

if (btnUnmuteAll) {
    // FIX: Always keep Unmute button active/clickable
    btnUnmuteAll.disabled = false;
    btnUnmuteAll.classList.remove('opacity-50');
}
}

let lastClockCheckTimestamp = 0; // NEW in 4.35: For missed bell recovery
let currentDay = new Date().getDay(); // NEW in 4.35: To clear missed bells

// NEW: Audio file state
let userAudioFiles = []; // { name, url, path }
let sharedAudioFiles = []; // { name, url, path }
let fileToUpload = null; // Holds the File object

// NEW in 4.44: Visual File State
let userVisualFiles = []; // { name, url, path }
let sharedVisualFiles = []; // { name, url, path }
let visualFileToUpload = null; // Holds the Image File object
let visualToDelete = null; // State for visual deletion
let periodVisualOverrides = {}; // Store local visual cue choices

// NEW V5.42.0: Passing Period Visual State
let personalPassingPeriodVisual = null;  // From personal schedule
let sharedPassingPeriodVisual = null;    // From shared schedule (admin-set default)

// NEW V5.46.0: Bulk Edit State
let bulkEditMode = false;
let bulkSelectedBells = new Set(); // Set of bell IDs

// NEW V5.46.1: Personal Bell Overrides (for shared bell customizations)
let personalBellOverrides = {}; // { bellId: { sound, visualCue, visualMode, nickname } }

// NEW V5.47.0: Picture-in-Picture state
let pipWindow = null; // Reference to the PiP window

// NEW V5.49.0: Kiosk Mode state
let kioskModeEnabled = false;

// NEW V5.52.0: Countdown Warning state
let warningSettings = {
enabled: false,
time: 60,           // seconds before bell to start warning
style: 'pulse',     // pulse, color, breathe, shake, all
intensity: 'medium', // subtle, medium, urgent
scheduledBells: true,
quickBells: true,
// V5.52.1: Custom colors
colorSubtle: '#fbbf24',
colorMedium: '#f97316',
colorUrgent: '#ef4444'
};
let currentWarningClass = null; // Track currently applied warning class

let currentSoundSelectTarget = null; // NEW V4.76: Stores <select> for audio modal

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

// --- Mute Helper Functions ---
// (getBellId moved to bell-engine.js in v5.72.0 — imported above)
// Reminder: its quote-only escaping is intentional (identity strings, not HTML).

function loadMutedBells() {
try {
    const stored = localStorage.getItem('mutedBellIds');
    if (stored) {
        mutedBellIds = new Set(JSON.parse(stored));
        console.log(`Loaded ${mutedBellIds.size} muted bell IDs.`);
        // NEW V5.05: Simple initialization of global mute state
        // We assume global mute is NOT active unless the user clicks it,
        // even if some bells are individually muted.
        isGlobalMuted = false;
    }
} catch (e) {
    console.error("Failed to load muted bells", e);
    mutedBellIds = new Set();
    isGlobalMuted = false; // Set default
}
}

function saveMutedBells() {
try {
    localStorage.setItem('mutedBellIds', JSON.stringify([...mutedBellIds]));
    // V5.53: Also save to cloud
    saveUserPreferencesToCloud();
} catch (e) {
    console.error("Failed to save muted bells", e);
}
}

// --- V5.47.9: Skip Bell Helper Functions ---
// Skipped bells are temporary (for today only) and not persisted

function getSkipKey(bell) {
// Use time + name as a reliable identifier (works for all bell types)
// Format: "HH:MM:SS|BellName|YYYY-MM-DD"
const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
const bellTime = bell.time || '00:00:00';
const bellName = (bell.name || 'Unknown').replace(/\|/g, '-'); // Escape pipe chars
return `${bellTime}|${bellName}|${today}`;
}

function isBellSkipped(bell) {
if (!bell) return false;
return skippedBellOccurrences.has(getSkipKey(bell));
}

function skipNextBell() {
// Find the next scheduled bell (not quick bell)
const now = new Date();
const currentTimeHHMMSS = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

const allBells = [...localSchedule, ...personalBells];

if (allBells.length === 0) {
    showUserMessage("No bells in schedule to skip.");
    return;
}

const upcomingBells = allBells
    .filter(bell => bell.time > currentTimeHHMMSS && !isBellSkipped(bell))
    .sort((a, b) => a.time.localeCompare(b.time));

if (upcomingBells.length === 0) {
    showUserMessage("No upcoming bells to skip today.");
    return;
}

const bellToSkip = upcomingBells[0];
const skipKey = getSkipKey(bellToSkip);
skippedBellOccurrences.add(skipKey);

console.log(`Skipped bell: ${bellToSkip.name} at ${bellToSkip.time} (key: ${skipKey})`);
showUserMessage(`Skipped: ${bellToSkip.name} at ${formatTime12Hour(bellToSkip.time, true)}`);

// Force immediate UI update
updateClock();
updatePipWindow();
updateMainPageSkipButtons();
}

function clearOldSkippedBells() {
// Clear any skipped bells from previous days
// Key format: "HH:MM:SS|BellName|YYYY-MM-DD"
const today = new Date().toISOString().split('T')[0];
const toRemove = [];

skippedBellOccurrences.forEach(key => {
    const datePart = key.split('|').pop(); // Get date from end of key
    if (datePart !== today) {
        toRemove.push(key);
    }
});

toRemove.forEach(key => skippedBellOccurrences.delete(key));

if (toRemove.length > 0) {
    console.log(`Cleared ${toRemove.length} old skipped bell(s)`);
}
}

function getNextSkippedBell() {
// Find the earliest skipped bell that's still upcoming
const now = new Date();
const currentTimeHHMMSS = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
const today = now.toISOString().split('T')[0];

const allBells = [...localSchedule, ...personalBells];
const skippedBells = allBells
    .filter(bell => {
        const skipKey = getSkipKey(bell);
        return skippedBellOccurrences.has(skipKey) && bell.time > currentTimeHHMMSS;
    })
    .sort((a, b) => a.time.localeCompare(b.time));

return skippedBells.length > 0 ? skippedBells[0] : null;
}

function unskipBell(bell) {
if (!bell) return;

const skipKey = getSkipKey(bell);
skippedBellOccurrences.delete(skipKey);

console.log(`Unskipped bell: ${bell.name} at ${bell.time}`);
showUserMessage(`Restored: ${bell.name} at ${formatTime12Hour(bell.time, true)}`);

// Force immediate UI update
updateClock();
updatePipWindow();
updateMainPageSkipButtons();
}

/**
* V5.47.13: Update Skip/Unskip buttons on main page
* V5.48: Also hide Skip Bell when no upcoming bells today
*/
function updateMainPageSkipButtons() {
const skipBtn = document.getElementById('skip-bell-btn');
const unskipBtn = document.getElementById('unskip-bell-btn');
if (!skipBtn || !unskipBtn) return;

// Check for upcoming bells
const now = new Date();
const currentTimeHHMMSS = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
const allBells = [...localSchedule, ...personalBells];
const upcomingBells = allBells.filter(bell => bell.time > currentTimeHHMMSS && !isBellSkipped(bell));

// Show/hide Skip Bell based on whether there are upcoming bells
if (upcomingBells.length === 0) {
    skipBtn.classList.add('hidden');
} else {
    skipBtn.classList.remove('hidden');
}

// Show/hide Unskip based on whether there's a skipped bell
const skippedBell = getNextSkippedBell();
if (skippedBell) {
    unskipBtn.classList.remove('hidden');
    const timeStr = formatTime12Hour(skippedBell.time, true);
    unskipBtn.textContent = `Unskip (${timeStr})`;
    unskipBtn.title = `Restore: ${skippedBell.name} at ${timeStr}`;
} else {
    unskipBtn.classList.add('hidden');
}
}

// --- NEW: Sound Override Functions ---
function getBellOverrideKey(scheduleId, bell) {
if (!scheduleId || !bell) return null;
// MODIFIED: v3.03 - We only override 'shared' bells
if (bell.type !== 'shared') return null;

// MODIFIED V4.88: Use the bell's *unique* database ID, not the fragile composite key.
// This makes overrides persistent even if an admin renames the bell,
// and guarantees uniqueness across all schedules, fixing the bug.
const uniqueBellId = bell.bellId; 
if (!uniqueBellId) {
    console.warn("getBellOverrideKey: Bell has no unique bellId.", bell);
    return null;
}
return `${scheduleId}-${uniqueBellId}`;
}

function loadSoundOverrides() {
try {
    const stored = localStorage.getItem('bellSoundOverrides');
    if (stored) {
        bellSoundOverrides = JSON.parse(stored);
        console.log(`Loaded ${Object.keys(bellSoundOverrides).length} sound overrides.`);
    }
} catch (e) {
    console.error("Failed to load sound overrides", e);
    bellSoundOverrides = {};
}
}

function saveSoundOverrides() {
try {
    localStorage.setItem('bellSoundOverrides', JSON.stringify(bellSoundOverrides));
    // V5.53: Also save to cloud
    saveUserPreferencesToCloud();
} catch (e) {
    console.error("Failed to save sound overrides", e);
}
}

// V5.55.9: Bell Visual Override Functions (for use without personal schedule)
function loadBellVisualOverrides() {
try {
    const stored = localStorage.getItem('bellVisualOverrides');
    if (stored) {
        bellVisualOverrides = JSON.parse(stored);
        console.log(`Loaded ${Object.keys(bellVisualOverrides).length} bell visual overrides.`);
    }
} catch (e) {
    console.error("Failed to load bell visual overrides", e);
    bellVisualOverrides = {};
}
}

function saveBellVisualOverrides() {
try {
    localStorage.setItem('bellVisualOverrides', JSON.stringify(bellVisualOverrides));
    saveUserPreferencesToCloud();
} catch (e) {
    console.error("Failed to save bell visual overrides", e);
}
}

// V5.55.9: Bell Name Override Functions (for use without personal schedule)
function loadBellNameOverrides() {
try {
    const stored = localStorage.getItem('bellNameOverrides');
    if (stored) {
        bellNameOverrides = JSON.parse(stored);
        console.log(`Loaded ${Object.keys(bellNameOverrides).length} bell name overrides.`);
    }
} catch (e) {
    console.error("Failed to load bell name overrides", e);
    bellNameOverrides = {};
}
}

function saveBellNameOverrides() {
try {
    localStorage.setItem('bellNameOverrides', JSON.stringify(bellNameOverrides));
    saveUserPreferencesToCloud();
} catch (e) {
    console.error("Failed to save bell name overrides", e);
}
}

// --- NEW in 4.22: Period Nickname Override Functions ---
function getPeriodOverrideKey(scheduleId, originalPeriodName) {
if (!scheduleId || !originalPeriodName) return null;
return `${scheduleId}-${originalPeriodName}`;
}

function loadPeriodNameOverrides() {
try {
    const stored = localStorage.getItem('periodNameOverrides');
    if (stored) {
        periodNameOverrides = JSON.parse(stored);
        console.log(`Loaded ${Object.keys(periodNameOverrides).length} period nicknames.`);
    }
} catch (e) {
    console.error("Failed to load period nicknames", e);
    periodNameOverrides = {};
}
}

function savePeriodNameOverrides() {
try {
    localStorage.setItem('periodNameOverrides', JSON.stringify(periodNameOverrides));
    // V5.53: Also save to cloud
    saveUserPreferencesToCloud();
} catch (e) {
    console.error("Failed to save period nicknames", e);
}
}

// --- NEW in 4.44: Period Visual Override Functions ---
function getVisualOverrideKey(scheduleId, originalPeriodName) {
// Use personal schedule ID if available, otherwise fall back to base schedule
const effectiveScheduleId = activePersonalScheduleId || scheduleId;
if (!effectiveScheduleId || !originalPeriodName) return null;
return `${effectiveScheduleId}-${originalPeriodName}`;
}

function loadVisualOverrides() {
try {
    const stored = localStorage.getItem('periodVisualOverrides');
    console.log('Loading from localStorage:', stored);
    if (stored) {
        periodVisualOverrides = JSON.parse(stored);
        console.log(`Loaded ${Object.keys(periodVisualOverrides).length} period visual overrides:`, periodVisualOverrides);
    }
} catch (e) {
    console.error("Failed to load visual overrides", e);
    periodVisualOverrides = {};
}
}

function saveVisualOverrides() {
try {
    console.log('Saving to localStorage:', periodVisualOverrides);
    localStorage.setItem('periodVisualOverrides', JSON.stringify(periodVisualOverrides));
    console.log('Successfully saved to localStorage');
    // V5.53: Also save to cloud
    saveUserPreferencesToCloud();
} catch (e) {
    console.error("Failed to save visual overrides", e);
}
}

