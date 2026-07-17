// ============================================================
// V5.65.0: Quick Bell Broadcast Functions
// Sync quick bells across all logged-in devices for the same user
// ============================================================

/**
 * Send a quick bell broadcast to Firestore
 */
async function broadcastQuickBell(action, hours, minutes, seconds, sound, name, durationMs) {
    if (!userId || isUserAnonymous) {
        console.log('[Broadcast] Cannot send - no user or anonymous');
        return;
    }
    
    const broadcastPath = `artifacts/${appId}/users/${userId}/quick_bell_broadcast/current`;
    console.log('[Broadcast] Sending to path:', broadcastPath);
    
    try {
        const broadcastRef = doc(db, 'artifacts', appId, 'users', userId, 'quick_bell_broadcast', 'current');
        const broadcastData = {
            action: action, // 'start' or 'cancel'
            hours: hours || 0,
            minutes: minutes || 0,
            seconds: seconds || 0,
            sound: sound || 'ellisBell.mp3',
            name: name || 'Quick Bell',
            durationMs: durationMs || 0,
            timestamp: Date.now(),
            originInstance: instanceId
        };
        console.log('[Broadcast] Data:', broadcastData);
        
        await setDoc(broadcastRef, broadcastData);
        console.log(`[Broadcast] Successfully sent ${action} broadcast for "${name}"`);
    } catch (error) {
        console.error('[Broadcast] Error sending broadcast:', error);
    }
}

/**
 * Set up listener for incoming quick bell broadcasts
 * NOTE: This listener should be active regardless of whether broadcastEnabled is true
 * The toggle only affects SENDING, not RECEIVING
 */
function setupBroadcastListener() {
    if (!userId || isUserAnonymous) {
        console.log('[Broadcast] Cannot set up listener - no user or anonymous');
        return;
    }
    
    // Clean up existing listener
    if (broadcastListenerUnsubscribe) {
        broadcastListenerUnsubscribe();
        broadcastListenerUnsubscribe = null;
    }
    
    const broadcastRef = doc(db, 'artifacts', appId, 'users', userId, 'quick_bell_broadcast', 'current');
    console.log('[Broadcast] Setting up listener at path:', `artifacts/${appId}/users/${userId}/quick_bell_broadcast/current`);
    
    broadcastListenerUnsubscribe = onSnapshot(broadcastRef, (docSnap) => {
        console.log('[Broadcast] Received snapshot, exists:', docSnap.exists());
        if (!docSnap.exists()) return;
        
        const data = docSnap.data();
        console.log('[Broadcast] Snapshot data:', data);
        
        // Ignore broadcasts from this instance
        if (data.originInstance === instanceId) {
            console.log('[Broadcast] Ignoring own broadcast (origin:', data.originInstance, ', this:', instanceId, ')');
            return;
        }
        
        // Ignore old broadcasts (more than 10 seconds old - increased from 5)
        const age = Date.now() - data.timestamp;
        if (age > 10000) {
            console.log(`[Broadcast] Ignoring stale broadcast (${age}ms old)`);
            return;
        }
        
        // Prevent duplicate processing
        if (data.timestamp <= lastProcessedBroadcastTimestamp) {
            console.log('[Broadcast] Ignoring already-processed broadcast');
            return;
        }
        lastProcessedBroadcastTimestamp = data.timestamp;
        
        console.log(`[Broadcast] Processing ${data.action} broadcast for "${data.name}"`);
        
        if (data.action === 'start') {
            // Start the quick bell locally (without re-broadcasting)
            const now = new Date();
            quickBellEndTime = new Date(now.getTime() + data.durationMs);
            quickBellEndTime.bellName = data.name;
            quickBellEndTime.wasBroadcast = true; // Mark as broadcast-received
            quickBellSound = data.sound;
            document.getElementById('cancel-quick-bell-btn').classList.remove('hidden');
            updateClock();
        } else if (data.action === 'cancel') {
            // Cancel the quick bell locally
            quickBellEndTime = null;
            document.getElementById('cancel-quick-bell-btn').classList.add('hidden');
            updateClock();
        }
    }, (error) => {
        console.error('[Broadcast] Listener error:', error);
    });
    
    console.log('[Broadcast] Listener set up successfully for user:', userId);
}

/**
 * Clean up broadcast listener
 */
function cleanupBroadcastListener() {
    if (broadcastListenerUnsubscribe) {
        broadcastListenerUnsubscribe();
        broadcastListenerUnsubscribe = null;
    }
}

/**
 * Toggle broadcast mode on/off
 */
function toggleBroadcastMode() {
    broadcastEnabled = !broadcastEnabled;
    updateBroadcastToggleUI();
    
    if (broadcastEnabled) {
        showUserMessage('📡 Broadcast ON - Quick bells will sync to all your devices');
    } else {
        showUserMessage('📡 Broadcast OFF - Quick bells only on this device');
    }
}

/**
 * Update the broadcast toggle button UI
 */
function updateBroadcastToggleUI() {
    const btn = document.getElementById('quick-bell-broadcast-toggle');
    if (!btn) return;
    
    if (broadcastEnabled) {
        btn.classList.remove('bg-gray-200', 'text-gray-500');
        btn.classList.add('bg-sky-500', 'text-white');
        btn.title = 'Broadcast to all devices (ON)';
    } else {
        btn.classList.remove('bg-sky-500', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-500');
        btn.title = 'Broadcast to all devices (off)';
    }
}

// ============================================================
// END V5.65.0: Quick Bell Broadcast Functions
// ============================================================

