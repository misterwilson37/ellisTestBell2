// ============================================
// V5.49.0: KIOSK MODE FUNCTIONALITY
// ============================================

/**
    * Load kiosk mode preference from localStorage
    */
function loadKioskModePreference() {
    try {
        const stored = localStorage.getItem('kioskModeEnabled');
        if (stored === 'true') {
            kioskModeEnabled = true;
            applyKioskMode(true);
        }
    } catch (e) {
        console.error('Error loading kiosk mode preference:', e);
    }
}

/**
    * Save kiosk mode preference to localStorage
    */
function saveKioskModePreference() {
    try {
        localStorage.setItem('kioskModeEnabled', kioskModeEnabled ? 'true' : 'false');
        // V5.53: Also save to cloud
        saveUserPreferencesToCloud();
    } catch (e) {
        console.error('Error saving kiosk mode preference:', e);
    }
}

/**
    * V5.55.5: Load quick bell sound preference from localStorage
    */
function loadQuickBellSoundPreference() {
    try {
        const stored = localStorage.getItem('quickBellDefaultSound');
        if (stored) {
            quickBellDefaultSound = stored;
            quickBellSound = stored;
            if (quickBellSoundSelect) {
                quickBellSoundSelect.value = stored;
            }
        }
    } catch (e) {
        console.error('Error loading quick bell sound preference:', e);
    }
}

/**
    * Apply or remove kiosk mode styling
    * @param {boolean} enabled - Whether to enable kiosk mode
    */
function applyKioskMode(enabled) {
    const body = document.body;
    const enterIcon = document.getElementById('kiosk-enter-icon');
    const exitIcon = document.getElementById('kiosk-exit-icon');
    const toggleBtn = document.getElementById('kiosk-toggle-btn');
    
    if (enabled) {
        body.classList.add('kiosk-mode');
        if (enterIcon) enterIcon.classList.add('hidden');
        if (exitIcon) exitIcon.classList.remove('hidden');
        if (toggleBtn) toggleBtn.title = 'Exit Kiosk Mode';
    } else {
        body.classList.remove('kiosk-mode');
        if (enterIcon) enterIcon.classList.remove('hidden');
        if (exitIcon) exitIcon.classList.add('hidden');
        if (toggleBtn) toggleBtn.title = 'Enter Kiosk Mode';
    }
}

/**
    * Toggle kiosk mode on/off
    */
function toggleKioskMode() {
    kioskModeEnabled = !kioskModeEnabled;
    applyKioskMode(kioskModeEnabled);
    saveKioskModePreference();
    
    // Also update PiP window if open
    if (pipWindow && !pipWindow.closed) {
        applyPipKioskMode(pipWindow.document, kioskModeEnabled);
    }
    
    console.log(`Kiosk mode: ${kioskModeEnabled ? 'enabled' : 'disabled'}`);
}

/**
    * Apply kiosk mode to PiP window
    * @param {Document} pipDoc - The PiP window document
    * @param {boolean} enabled - Whether kiosk mode is enabled
    */
function applyPipKioskMode(pipDoc, enabled) {
    if (!pipDoc) return;
    
    const pipBody = pipDoc.body;
    const quickBellsRow = pipDoc.getElementById('pip-quick-bells');
    const actionButtons = pipDoc.querySelector('.pip-action-buttons');
    const enterIcon = pipDoc.getElementById('pip-kiosk-enter-icon');
    const exitIcon = pipDoc.getElementById('pip-kiosk-exit-icon');
    const toggleBtn = pipDoc.getElementById('pip-kiosk-toggle-btn');
    
    if (enabled) {
        if (pipBody) pipBody.classList.add('pip-kiosk-mode');
        if (quickBellsRow) quickBellsRow.style.display = 'none';
        if (actionButtons) actionButtons.style.display = 'none';
        if (enterIcon) enterIcon.classList.add('hidden');
        if (exitIcon) exitIcon.classList.remove('hidden');
        if (toggleBtn) toggleBtn.title = 'Exit Kiosk Mode';
    } else {
        if (pipBody) pipBody.classList.remove('pip-kiosk-mode');
        if (quickBellsRow) quickBellsRow.style.display = '';
        if (actionButtons) actionButtons.style.display = '';
        if (enterIcon) enterIcon.classList.remove('hidden');
        if (exitIcon) exitIcon.classList.add('hidden');
        if (toggleBtn) toggleBtn.title = 'Enter Kiosk Mode';
    }
}

