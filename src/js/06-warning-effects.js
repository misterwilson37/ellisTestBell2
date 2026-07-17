// ============================================
// V5.52.0: COUNTDOWN WARNING FUNCTIONALITY
// ============================================

/**
    * Load warning settings from localStorage
    */
function loadWarningSettings() {
    try {
        const stored = localStorage.getItem('countdownWarningSettings');
        if (stored) {
            const parsed = JSON.parse(stored);
            warningSettings = { ...warningSettings, ...parsed };
            console.log('[Warning] Settings loaded:', warningSettings);
        }
        // V5.52.1: Apply custom colors on load
        applyWarningColors();
    } catch (e) {
        console.error('[Warning] Error loading settings:', e);
    }
}

/**
    * Save warning settings to localStorage
    */
function saveWarningSettings() {
    try {
        localStorage.setItem('countdownWarningSettings', JSON.stringify(warningSettings));
        console.log('[Warning] Settings saved:', warningSettings);
        // V5.52.1: Apply custom colors after saving
        applyWarningColors();
        // V5.53: Also save to cloud
        saveUserPreferencesToCloud();
    } catch (e) {
        console.error('[Warning] Error saving settings:', e);
    }
}

/**
    * V5.52.1: Apply custom warning colors to CSS variables
    */
function applyWarningColors() {
    const root = document.documentElement;
    root.style.setProperty('--warning-color-subtle', warningSettings.colorSubtle);
    root.style.setProperty('--warning-color-medium', warningSettings.colorMedium);
    root.style.setProperty('--warning-color-urgent', warningSettings.colorUrgent);
}

/**
    * V5.52.1: Reset warning colors to defaults
    */
function resetWarningColors() {
    warningSettings.colorSubtle = '#fbbf24';
    warningSettings.colorMedium = '#f97316';
    warningSettings.colorUrgent = '#ef4444';
    
    // Update color inputs in modal
    const subtleInput = document.getElementById('warning-color-subtle');
    const mediumInput = document.getElementById('warning-color-medium');
    const urgentInput = document.getElementById('warning-color-urgent');
    
    if (subtleInput) subtleInput.value = warningSettings.colorSubtle;
    if (mediumInput) mediumInput.value = warningSettings.colorMedium;
    if (urgentInput) urgentInput.value = warningSettings.colorUrgent;
    
    applyWarningColors();
}

/**
    * Get the appropriate warning class based on settings and time remaining
    * @param {number} secondsRemaining - Seconds until bell
    * @param {boolean} isQuickBell - Whether this is a quick bell timer
    * @returns {string|null} CSS class to apply, or null if no warning
    */
function getWarningClass(secondsRemaining, isQuickBell = false) {
    if (!warningSettings.enabled) return null;
    if (isQuickBell && !warningSettings.quickBells) return null;
    if (!isQuickBell && !warningSettings.scheduledBells) return null;
    if (secondsRemaining > warningSettings.time || secondsRemaining <= 0) return null;
    
    // Calculate intensity based on time remaining
    const timeRatio = secondsRemaining / warningSettings.time;
    let intensity;
    
    if (timeRatio > 0.5) {
        intensity = 'subtle';
    } else if (timeRatio > 0.2) {
        intensity = 'medium';
    } else {
        intensity = 'urgent';
    }
    
    // If user set a fixed intensity, use that instead
    if (warningSettings.intensity !== 'auto') {
        // Progressive: start at subtle, escalate based on user's max
        if (warningSettings.intensity === 'subtle') {
            intensity = 'subtle';
        } else if (warningSettings.intensity === 'medium') {
            intensity = timeRatio > 0.5 ? 'subtle' : 'medium';
        } else if (warningSettings.intensity === 'urgent') {
            intensity = timeRatio > 0.5 ? 'subtle' : (timeRatio > 0.2 ? 'medium' : 'urgent');
        }
    }
    
    return `warning-${warningSettings.style}-${intensity}`;
}

/**
    * Apply warning effect to visual cue container
    * @param {number} secondsRemaining - Seconds until bell
    * @param {boolean} isQuickBell - Whether this is a quick bell timer
    */
function applyWarningEffect(secondsRemaining, isQuickBell = false) {
    const container = document.getElementById('visual-cue-container');
    if (!container) return;
    
    const newClass = getWarningClass(secondsRemaining, isQuickBell);
    
    // Remove old warning class if different
    if (currentWarningClass && currentWarningClass !== newClass) {
        container.classList.remove(currentWarningClass);
    }
    
    // Apply new warning class
    if (newClass && newClass !== currentWarningClass) {
        container.classList.add(newClass);
        currentWarningClass = newClass;
    } else if (!newClass && currentWarningClass) {
        container.classList.remove(currentWarningClass);
        currentWarningClass = null;
    }
    
    // Also apply to PiP window if open
    if (pipWindow && !pipWindow.closed) {
        const pipContainer = pipWindow.document.getElementById('pip-visual');
        if (pipContainer) {
            // Remove all warning classes first
            pipContainer.className = pipContainer.className.replace(/warning-\S+/g, '').trim();
            if (newClass) {
                pipContainer.classList.add(newClass);
            }
        }
    }
}

/**
    * Clear all warning effects
    */
function clearWarningEffects() {
    const container = document.getElementById('visual-cue-container');
    if (container && currentWarningClass) {
        container.classList.remove(currentWarningClass);
    }
    currentWarningClass = null;
    
    // Also clear from PiP
    if (pipWindow && !pipWindow.closed) {
        const pipContainer = pipWindow.document.getElementById('pip-visual');
        if (pipContainer) {
            pipContainer.className = pipContainer.className.replace(/warning-\S+/g, '').trim();
        }
    }
}

/**
    * Open warning settings modal
    */
function openWarningSettingsModal() {
    const modal = document.getElementById('warning-settings-modal');
    if (!modal) return;
    
    // Populate form with current settings
    document.getElementById('warning-enabled').checked = warningSettings.enabled;
    document.getElementById('warning-time').value = warningSettings.time;
    document.getElementById('warning-style').value = warningSettings.style;
    document.getElementById('warning-intensity').value = warningSettings.intensity;
    document.getElementById('warning-scheduled-bells').checked = warningSettings.scheduledBells;
    document.getElementById('warning-quick-bells').checked = warningSettings.quickBells;
    
    // V5.52.1: Populate color inputs
    document.getElementById('warning-color-subtle').value = warningSettings.colorSubtle;
    document.getElementById('warning-color-medium').value = warningSettings.colorMedium;
    document.getElementById('warning-color-urgent').value = warningSettings.colorUrgent;
    
    modal.classList.remove('hidden');
}

/**
    * Close warning settings modal
    */
function closeWarningSettingsModal() {
    const modal = document.getElementById('warning-settings-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    // Stop any preview animation
    stopWarningPreview();
}

/**
    * Save warning settings from modal
    */
function saveWarningSettingsFromModal() {
    warningSettings.enabled = document.getElementById('warning-enabled').checked;
    warningSettings.time = parseInt(document.getElementById('warning-time').value) || 60;
    warningSettings.style = document.getElementById('warning-style').value;
    warningSettings.intensity = document.getElementById('warning-intensity').value;
    warningSettings.scheduledBells = document.getElementById('warning-scheduled-bells').checked;
    warningSettings.quickBells = document.getElementById('warning-quick-bells').checked;
    
    // V5.52.1: Save custom colors
    warningSettings.colorSubtle = document.getElementById('warning-color-subtle').value;
    warningSettings.colorMedium = document.getElementById('warning-color-medium').value;
    warningSettings.colorUrgent = document.getElementById('warning-color-urgent').value;
    
    saveWarningSettings();
    closeWarningSettingsModal();
    
    // Clear any existing warnings so they recalculate
    clearWarningEffects();
}

/**
    * Preview warning effect in modal
    */
let warningPreviewTimeout = null;
function previewWarningEffect() {
    const preview = document.getElementById('warning-preview');
    if (!preview) return;
    
    // Get current form values
    const style = document.getElementById('warning-style').value;
    const intensity = document.getElementById('warning-intensity').value;
    
    // V5.52.1: Apply current color settings from form for preview
    const root = document.documentElement;
    root.style.setProperty('--warning-color-subtle', document.getElementById('warning-color-subtle').value);
    root.style.setProperty('--warning-color-medium', document.getElementById('warning-color-medium').value);
    root.style.setProperty('--warning-color-urgent', document.getElementById('warning-color-urgent').value);
    
    // Clear previous preview
    preview.className = 'mx-auto w-24 h-24 bg-gray-800 rounded-lg flex items-center justify-center';
    
    // Apply preview class
    const previewClass = `warning-${style}-${intensity}`;
    preview.classList.add(previewClass);
    
    // Stop after 3 seconds
    if (warningPreviewTimeout) clearTimeout(warningPreviewTimeout);
    warningPreviewTimeout = setTimeout(() => {
        stopWarningPreview();
    }, 3000);
}

/**
    * Stop warning preview
    */
function stopWarningPreview() {
    const preview = document.getElementById('warning-preview');
    if (preview) {
        preview.className = 'mx-auto w-24 h-24 bg-gray-800 rounded-lg flex items-center justify-center';
    }
    if (warningPreviewTimeout) {
        clearTimeout(warningPreviewTimeout);
        warningPreviewTimeout = null;
    }
}

