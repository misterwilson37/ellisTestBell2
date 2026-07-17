async function initFirebase() {
    if (auth) return; 

    try {
        // V5.67.0: Read config from shared firebase-config.js (loaded before this
        // module in index.html). Previously this block declared a local
        // firebaseConfig const — now kept in one place across all surfaces.
        if (!window.firebaseConfig) {
            throw new Error("firebase-config.js must load before script.js. Check index.html <script> order.");
        }
        const firebaseConfig = window.firebaseConfig;
        
        // MODIFIED: v4.26 - Set global appId from hardcoded config
        appId = firebaseConfig.appId;
        
        // 3. Initialize Firebase
        const app = initializeApp(firebaseConfig);
        
        db = getFirestore(app);
        auth = getAuth(app);
        storage = getStorage(app); // NEW: Initialize Storage
        
        setLogLevel('Debug');

        // MODIFIED: v3.44 - REMOVED the automatic signInAnonymously() block.
        // The onAuthStateChanged listener will now correctly
        // see a null user on initial load, prompting the welcome overlay.
        
        /*
        DELETED in v3.44:
        try {
            // Check if token exists and is not an empty string
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) { 
                await signInWithCustomToken(auth, __initial_auth_token);
                console.log("Signed in with custom token.");
            } else { 
                // Fallback to anonymous sign-in if no token is provided
                await signInAnonymously(auth);
                console.log("Signed in anonymously.");
            }
        } catch (authError) {
            console.error("Error during initial sign-in:", authError);
            statusElement.textContent = "Error: Could not sign in.";
            // Don't stop here, let onAuthStateChanged handle the null user state
        }
        */
        
            onAuthStateChanged(auth, async (user) => {
            // Clear admin state on any auth change
            document.body.classList.remove('admin-mode');
            adminToggleBtn.textContent = 'Toggle Admin';

            if (user) {
                // --- NEW V4.74: Load all local overrides *before* attaching listeners ---
                // This fixes the race condition where icons wouldn't load.
                loadMutedBells();
                loadSoundOverrides();
                loadBellVisualOverrides(); // V5.55.9
                loadBellNameOverrides(); // V5.55.9
                loadPeriodNameOverrides();
                loadVisualOverrides();
                // --- END V4.74 FIX ---

                console.log("User is signed in:", user.uid);
                userId = user.uid;
                startClockDriftMonitor(); // V5.77.0: idempotent; needs a uid
                isUserAnonymous = user.isAnonymous; // NEW: Track anonymous state
                welcomeOverlay.classList.add('hidden'); 
                
                // NEW: Handle visibility based on anonymous state
                if (user.isAnonymous) {
                    document.body.classList.remove('not-anonymous');
                } else {
                    document.body.classList.add('not-anonymous');
                }
                
                if (!isAudioReady) {
                    console.log("User is signed in, but audio not ready. Showing audio start button.");
                    
                    // NEW: Set custom button text based on user
                    let btnText = "Click to Start Audio";
                    if (user.isAnonymous) {
                        btnText = "You're logged in anonymously, so let's get started!";
                    } else {
                        const name = user.displayName || user.email;
                        btnText = `You're already logged in as ${name}, so let's get started!`;
                    }
                    startAudioBtn.textContent = btnText;
                    
                    audioOverlay.classList.remove('hidden');
                } else {
                    // MODIFIED in 4.33: Removed auto-start. Clock will be started
                    // by recalculateAndRenderAll() when the schedule is loaded.
                    console.log("User signed in, audio ready. Waiting for schedule to start clock.");
                }

                document.body.classList.add('authenticated');
                signOutBtn.classList.remove('hidden');
                if (user.isAnonymous) {
                    userIdElement.textContent = `Anonymous ID: ${user.uid}`;
                    // NEW: Set header display name
                    userDisplayNameElement.textContent = "Signed in as: Anonymous";
                } else {
                    // MODIFIED: Display User ID in the footer, not the header
                    userIdElement.textContent = `User ID: ${user.uid}`;
                    // NEW: Set header display name
                    const displayName = user.displayName || user.email;
                    currentUserDisplayName = displayName; // V5.75.0: for the edit audit log
                    userDisplayNameElement.textContent = `Signed in as: ${displayName}`;
                }

                // MODIFIED: v3.24 - Admin Check now ONLY checks Firestore
                let isAdmin = false; // Local admin flag
                if (!user.isAnonymous && user.uid) { // Check for non-anonymous user
                    try {
                        const adminDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'admins', user.uid);
                        const adminDocSnap = await getDoc(adminDocRef);
                        
                        if (adminDocSnap.exists()) {
                            console.log("Server admin status confirmed for user:", user.email);
                            isAdmin = true;
                        } else {
                            console.log("Standard user detected:", user.email);
                        }
                    } catch (err) {
                        console.error("Error checking admin status:", err);
                    }
                } else {
                        console.log("Anonymous user, skipping admin check.");
                }

                // NEW: Enable admin toggle *only* if server-side check passed
                if (isAdmin) {
                    adminToggleBtn.disabled = false;
                    adminToggleBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    adminToggleBtn.title = "Toggle administrator controls";
                } else {
                    adminToggleBtn.disabled = true;
                    adminToggleBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    adminToggleBtn.title = "Admin access required";
                }
                
                // NEW: v3.03 - Also load personal schedules
                if (!user.isAnonymous) {
                    // MODIFIED: v3.09 - Start real-time listener instead of one-time load
                    listenForPersonalSchedules(user.uid);
                    // NEW V5.00: Start Custom Quick Bell listener
                    listenForCustomQuickBells(user.uid);
                    // V5.65.0: Set up broadcast listener for quick bell sync
                    setupBroadcastListener();
                    // V5.53: Load cloud preferences and set up listener
                    await loadUserPreferencesFromCloud();
                    setupUserPreferencesListener();
                    // V5.63.0: Load following schedules
                    await loadFollowingSchedules();
                    updateFollowingButton();
                    // NEW V5.00: Enable custom quick bell button
                    showCustomQuickBellManagerBtn.disabled = false;
                    showCustomQuickBellManagerBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    // V5.44: Enable standalone schedule button
                    createStandaloneScheduleBtn.disabled = false;
                    createStandaloneScheduleBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    // V5.65.0: Enable broadcast toggle
                    const broadcastBtn = document.getElementById('quick-bell-broadcast-toggle');
                    if (broadcastBtn) {
                        broadcastBtn.disabled = false;
                        broadcastBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                } else {
                    allPersonalSchedules = []; // Clear personal schedules
                    followingSchedules = []; // V5.63.0: Clear following schedules
                    // NEW V5.00: Disable custom quick bell button
                    showCustomQuickBellManagerBtn.disabled = true;
                    showCustomQuickBellManagerBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    // V5.44: Disable standalone schedule button
                    createStandaloneScheduleBtn.disabled = true;
                    createStandaloneScheduleBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    // V5.65.0: Disable broadcast toggle for anonymous users
                    const broadcastBtnAnon = document.getElementById('quick-bell-broadcast-toggle');
                    if (broadcastBtnAnon) {
                        broadcastBtnAnon.disabled = true;
                        broadcastBtnAnon.classList.add('opacity-50', 'cursor-not-allowed');
                    }
                }
                schedulesCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'schedules');
                // MODIFIED: v3.24 - Changed to real-time listener
                await listenForSharedSchedules(); 
                
                // NEW: Load audio files if not anonymous
                if (!user.isAnonymous) {
                    await loadAllAudioFiles();
                } else {
                    // If user is anonymous, clear/hide audio file lists
                    userAudioFiles = [];
                    sharedAudioFiles = []; // They can still see shared, but let's load them
                    await loadAllAudioFiles(); // Load only shared files
                    renderAudioFileManager();
                    updateSoundDropdowns();
                }

                // NEW in 4.44: Load Visuals
                loadVisualOverrides();
                await loadAllVisualFiles();
                
                if (isAudioReady) {
                    statusElement.textContent = "Connected. Monitoring bells...";
                } else {
                    statusElement.textContent = "Connected. Waiting for audio.";
                }


                } else {
                console.log("User is signed out.");
                userId = null;
                isUserAnonymous = true;
                isScheduleReady = false; // NEW in 4.33: Reset flag
                
                // NEW in 4.33: Stop the keep-alive oscillator
                if (keepAliveOscillator) {
                    keepAliveOscillator.stop();
                    keepAliveOscillator.dispose();
                    keepAliveOscillator = null;
                }
                
                // NEW in 4.38: Stop the alert interval
                if (oscillatorAlertInterval) {
                    clearInterval(oscillatorAlertInterval);
                    oscillatorAlertInterval = null;
                }
                isOscillatorAlert = false; // Reset flag

                if (clockIntervalId) {
                    clearInterval(clockIntervalId);
                    clockIntervalId = null;
                }

                // NEW: v3.09 - Unsubscribe from personal schedules
                if (personalSchedulesListenerUnsubscribe) {
                    personalSchedulesListenerUnsubscribe();
                    personalSchedulesListenerUnsubscribe = null;
                }
                // NEW: v3.24 - Unsubscribe from shared schedules
                if (sharedSchedulesListenerUnsubscribe) {
                    sharedSchedulesListenerUnsubscribe();
                    sharedSchedulesListenerUnsubscribe = null;
                }
                // NEW V5.00: Unsubscribe from custom quick bells
                if (customQuickBellsListenerUnsubscribe) {
                    customQuickBellsListenerUnsubscribe();
                    customQuickBellsListenerUnsubscribe = null;
                }
                // V5.65.0: Clean up broadcast listener
                cleanupBroadcastListener();
                broadcastEnabled = false;
                updateBroadcastToggleUI();
                // V5.53: Unsubscribe from user preferences
                if (userPreferencesListenerUnsubscribe) {
                    userPreferencesListenerUnsubscribe();
                    userPreferencesListenerUnsubscribe = null;
                }
                
                document.body.classList.remove('authenticated', 'not-anonymous', 'admin-mode');
                signOutBtn.classList.add('hidden');
                userIdElement.textContent = "Not signed in.";
                userDisplayNameElement.textContent = ""; // NEW: Clear header display name
                adminToggleBtn.disabled = true;
                adminToggleBtn.classList.add('opacity-50', 'cursor-not-allowed');
                adminToggleBtn.title = "Sign in to see admin options";
                
                localSchedule = [];
                personalBells = []; // NEW: v3.03
                allSchedules = [];
                allPersonalSchedules = []; // NEW: v3.03
                renderScheduleSelector();
                renderCombinedList();
                statusElement.textContent = "Please sign in to load schedules.";
                
                clockElement.textContent = `Please sign in`;
                countdownElement.textContent = "--:--";
                nextBellElement.textContent = `to load the schedule.`;
                
                welcomeOverlay.classList.remove('hidden');
                audioOverlay.classList.add('hidden');
                }
            });

    } catch (error) {
        console.error("Firebase Init Error:", error);
        statusElement.textContent = "Error connecting to Firebase.";
    }
}

// DELETED: v3.09 - loadPersonalSchedules() was removed and replaced by listenForPersonalSchedules()

// NEW: v3.09 - Replaces loadPersonalSchedules with a real-time listener
function listenForPersonalSchedules(userId) {
    if (isUserAnonymous || !userId) {
        allPersonalSchedules = [];
        renderScheduleSelector(); // Make sure to re-render
        return;
    }

    // Clean up old listener if it exists
    if (personalSchedulesListenerUnsubscribe) {
        personalSchedulesListenerUnsubscribe();
    }

    const personalSchedulesRef = collection(db, 'artifacts', appId, 'users', userId, 'personal_schedules');
    
    console.log("Listening for real-time personal schedule updates...");
    
    personalSchedulesListenerUnsubscribe = onSnapshot(personalSchedulesRef, (querySnapshot) => {
        allPersonalSchedules = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data() // name, baseScheduleId, bells[]
        }));
        allPersonalSchedules.sort((a, b) => a.name.localeCompare(b.name));
        
        console.log("Personal schedules updated from snapshot:", allPersonalSchedules.length);
        
        // CRITICAL: We must re-render the selector AND check if the active schedule still exists
        const currentSelectedValue = scheduleSelector.value;
        const activeScheduleExists = allPersonalSchedules.some(s => `personal-${s.id}` === currentSelectedValue);

        renderScheduleSelector(); // This re-renders the list
        // V5.73.0: reapply the day-type calendar AFTER this callback's own
        // selector-restoration logic below has finished (deferred to the next
        // tick so the two can't fight over scheduleSelector.value).
        setTimeout(() => applyCalendarSchedule('schedules-updated'), 0);
        setTimeout(() => renderEmergencyShiftPanel(), 0); // V5.74.0
        
        // If the currently selected schedule was a personal one and it still exists, keep it.
        // If it was deleted, renderScheduleSelector's logic will pick a default.
        if (currentSelectedValue.startsWith('personal-') && activeScheduleExists) {
            scheduleSelector.value = currentSelectedValue;
            // Note: We don't call setActiveSchedule here, as renderScheduleSelector's
            // default logic will handle picking the right schedule, and
            // we don't want to trigger a listener loop.
        } else if (!currentSelectedValue.startsWith('personal-')) {
            // Do nothing, the shared schedule selection is fine
        } else {
            // The active personal schedule was deleted, setActiveSchedule will be
            // called by renderScheduleSelector's default logic.
            console.log("Active personal schedule was deleted. Reverting to default.");
        }

    }, (error) => {
        console.error("Error listening to personal schedules: ", error);
    });
}


// MODIFIED: v3.24 - Renamed from loadSharedSchedules, converted to onSnapshot
async function listenForSharedSchedules() {
    if (sharedSchedulesListenerUnsubscribe) {
        sharedSchedulesListenerUnsubscribe(); // Unsubscribe from old one if exists
    }
    if (!schedulesCollectionRef) {
            schedulesCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'schedules');
    }

    console.log("Listening for real-time shared schedule updates...");
    listenForScheduleCalendar(); // V5.73.0: day-type calendar rides alongside

    sharedSchedulesListenerUnsubscribe = onSnapshot(schedulesCollectionRef, (querySnapshot) => {
        // MODIFIED V4.88: Read the 'periods' array, not the legacy 'bells' array.
        // This fixes the 'undefined.findIndex' error when editing shared bells.
        // MODIFIED V4.90: CRITICAL FIX for Admin functions.
        // This listener MUST run the same migration logic as setActiveSchedule.
        allSchedules = querySnapshot.docs.map(doc => {
            const scheduleData = doc.data();
            let periodsToUse = [];
            
            // 1. Check for 'periods' array first
            if (scheduleData.periods && scheduleData.periods.length > 0) {
                periodsToUse = scheduleData.periods;
            } 
            // 2. If no 'periods', migrate from 'bells'
            else if (scheduleData.bells && scheduleData.bells.length > 0) {
                periodsToUse = migrateLegacyBellsToPeriods(scheduleData.bells);
                console.log(`(Admin List) Migrating legacy schedule: ${scheduleData.name}`);
            }

            // 3. Assign unique bellIds if missing (for override/edit logic)
            let needsIdMigration = false;
            periodsToUse.forEach(period => {
                period.bells.forEach(bell => {
                    if (!bell.bellId) {
                        bell.bellId = generateBellId();
                        needsIdMigration = true;
                    }
                });
            });
            
            // 4. (Admin-only) Save back migrated IDs
            if (needsIdMigration && document.body.classList.contains('admin-mode')) {
                console.log(`(Admin List) Saving migrated bellIds for ${scheduleData.name}`);
                const scheduleRef = doc(db, 'artifacts', appId, 'public', 'data', 'schedules', doc.id);
                // Fire-and-forget, do not await
                updateDoc(scheduleRef, { periods: periodsToUse }); 
            }

            return {
                id: doc.id,
                name: scheduleData.name || "Unnamed Schedule",
                periods: periodsToUse, // Use the migrated periods
                bells: scheduleData.bells || [], // Keep legacy for migrate check
                temporaryShift: scheduleData.temporaryShift || null // V5.74.0
            };
        });
        allSchedules.sort((a, b) => a.name.localeCompare(b.name));
        console.log("Shared schedules updated from snapshot:", allSchedules.length);

        // The dropdown is disabled by default, we must enable it now.
        scheduleSelector.disabled = false;
        
        // CRITICAL: We must re-render the selector AND check if the active schedule still exists
        const currentSelectedValue = scheduleSelector.value;
        const activeScheduleExists = allSchedules.some(s => `shared-${s.id}` === currentSelectedValue);

        renderScheduleSelector(); // This re-renders the list
        // V5.73.0: reapply the day-type calendar AFTER this callback's own
        // selector-restoration logic below has finished (deferred to the next
        // tick so the two can't fight over scheduleSelector.value).
        setTimeout(() => applyCalendarSchedule('schedules-updated'), 0);
        setTimeout(() => renderEmergencyShiftPanel(), 0); // V5.74.0
        
        // If the currently selected schedule was a shared one and it still exists, keep it.
        if (currentSelectedValue.startsWith('shared-') && activeScheduleExists) {
            scheduleSelector.value = currentSelectedValue;
        } else if (currentSelectedValue.startsWith('personal-')) {
            // Do nothing, the personal schedule selection is fine
        } else {
            // The active shared schedule was deleted, or no schedule was selected
            // renderScheduleSelector's default logic will handle this.
            console.log("Active shared schedule was deleted or none selected. Reverting to default.");
        }

    }, (error) => {
        console.error("Error listening to shared schedules: ", error);
        statusElement.textContent = "Error loading schedules.";
    });
}

// NEW V5.00: Listener for Custom Quick Bells
function listenForCustomQuickBells(userId) {
    if (isUserAnonymous || !userId) {
        customQuickBells = [];
        renderCustomQuickBells();
        return;
    }

    if (customQuickBellsListenerUnsubscribe) {
        customQuickBellsListenerUnsubscribe();
    }
    
    const quickBellDocRef = doc(db, 'artifacts', appId, 'users', userId, 'settings', 'quick_bells');
    
    console.log("Listening for real-time custom quick bell updates...");
    
    customQuickBellsListenerUnsubscribe = onSnapshot(quickBellDocRef, (docSnap) => {
        console.log("Custom Quick Bells snapshot received");
        if (docSnap.exists() && docSnap.data().bells) {
            console.log("Raw bells from Firestore:", docSnap.data().bells);
            // Ensure we have max 4 and they are structured correctly
            // Initialize bellId if missing and ensure proper structure
            const bells = (docSnap.data().bells || []).slice(0, 4).map((b, index) => ({
                id: index + 1, // Use index + 1 as the ID 
                name: b.name || `Custom Timer ${index + 1}`,
                hours: b.hours || 0,   // V5.44.9: Include hours field
                minutes: b.minutes || 0,
                seconds: b.seconds || 0,
                // NEW V5.00: Read Icon Colors
                iconText: b.iconText || String(index + 1),
                iconBgColor: b.iconBgColor || '#4B9CD3',
                iconFgColor: b.iconFgColor || '#FFFFFF',
                // Added 5.25 to get visual uploads working
                visualCue: b.visualCue || `[CUSTOM_TEXT] ${index + 1}|#4B9CD3|#FFFFFF`,
                    
                sound: b.sound || 'ellisBell.mp3',
                isActive: b.isActive !== false // 5.19.3 Default to TRUE (active/checked)
            }));
            console.log("Processed bells:", bells);
            customQuickBells = bells.filter(b => b.name); // Filter out empty slots if structure is clean
        } else {
            // Initialize the array to empty, renderCustomQuickBells will handle slots
            customQuickBells = [];
        }
        
        // We must ensure the array has 4 slots for the manager UI
        while (customQuickBells.length < 4) {
            customQuickBells.push(null);
        }
        
        console.log("Custom Quick Bells updated from snapshot:", customQuickBells.filter(b => b).length);
        renderCustomQuickBells();

    }, (error) => {
        console.error("Error listening to custom quick bells: ", error);
    });
}

// NEW: v4.02 - Form rendering and logic handlers

/**
    * NEW: v4.02 - Populates the Period selector dropdowns based on the active schedule.
    */
function populatePeriodSelectors() {
    // Get all unique period names from the active schedule
    let periodNames = [];
    const combinedPeriods = [...localSchedulePeriods, ...personalBellsPeriods];
    
    combinedPeriods.forEach(p => {
        if (!periodNames.includes(p.name)) {
            periodNames.push(p.name);
        }
    });
    
    periodNames.sort(); // Sort alphabetically

    const optionsHtml = periodNames.map(name => `<option value="${name}">${name}</option>`).join('');

    // Update selectors
    const sharedPeriodSelect = document.getElementById('shared-bell-period');
    const personalPeriodSelect = document.getElementById('personal-bell-period');

    if (sharedPeriodSelect) {
        sharedPeriodSelect.innerHTML = `<option value="" disabled selected>Select Period...</option>` + optionsHtml;
    }
    if (personalPeriodSelect) {
        personalPeriodSelect.innerHTML = `<option value="" disabled selected>Select Period...</option>` + optionsHtml;
    }
}
    
// MODIFIED: v4.02 - Complete rewrite to handle period structures and legacy data
