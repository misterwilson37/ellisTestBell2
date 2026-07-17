
// MODIFIED: v3.22 -> v3.23 - Grammar changes
function updateClock() {
    const now = new Date();
    const nowTimestamp = now.getTime(); // Get current time in ms
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const currentTimeHHMMSS = `${hours}:${minutes}:${seconds}`;

    // --- 1. Update Live Clock Display ---
    // Use (false) to ensure seconds are always shown for the clock
    const formattedTime = formatTime12Hour(currentTimeHHMMSS, false); 
    // MODIFICATION: Removed period after "are"
    clockElement.textContent = `The time is ${formattedTime}. There are`;
    
    // --- 2. Find Bells & Calculate Timers ---
    const allBells = [...localSchedule, ...personalBells];
    const scheduleBellObject = findNextBell(currentTimeHHMMSS); // The bell we will count down to
    
    let millisToScheduleBell = Infinity;
    if (scheduleBellObject) {
        // V5.66.3: Handle both "HH:MM" and "HH:MM:SS" formats
        const timeParts = scheduleBellObject.time.split(':').map(Number);
        const h = timeParts[0] || 0;
        const m = timeParts[1] || 0;
        const s = timeParts[2] || 0; // Default seconds to 0 if not provided
        const nextBellDate = new Date();
        nextBellDate.setHours(h, m, s, 0);
        millisToScheduleBell = nextBellDate.getTime() - nowTimestamp;
        if (millisToScheduleBell < 0) { // If bell time has passed for today
            nextBellDate.setDate(nextBellDate.getDate() + 1);
            millisToScheduleBell = nextBellDate.getTime() - nowTimestamp;
        }
    }

    // V5.55.0: Handle queue timer end time
    const effectiveQuickBellEndTime = queueActive ? queueTimerEndTime : quickBellEndTime;
    const millisToQuickBell = effectiveQuickBellEndTime ? effectiveQuickBellEndTime.getTime() - nowTimestamp : Infinity;
    
    // --- 3. Determine Active Countdown & "Next Bell" Info ---
    let activeTimerLabel = null;
    let activeTimerMillis = Infinity;
    let isMuting = false;
    let nextBellInfoString = "No more bells today."; // Default "Next Bell" text

    if (millisToScheduleBell < millisToQuickBell && scheduleBellObject) {
        // --- A. Counting down to a SCHEDULE BELL ---
        activeTimerLabel = scheduleBellObject.name;
        activeTimerMillis = millisToScheduleBell;
        const nextBellId = getBellId(scheduleBellObject);
        isMuting = mutedBellIds.has(nextBellId);
        
        // Find the bell *after* this one for the info display
        const bellAfter = findBellAfter(scheduleBellObject, allBells);
        if (bellAfter) {
            // Use (true) to omit seconds if they are 00
            // MODIFICATION: Added period at the end
            nextBellInfoString = `Next bell is ${bellAfter.name} at ${formatTime12Hour(bellAfter.time, true)}.`;
        } else {
            nextBellInfoString = "No more bells today."; // Already has period
        }

    } else if (millisToQuickBell < millisToScheduleBell) {
        // --- B. Counting down to a QUICK BELL or QUEUE TIMER ---
        if (queueActive && queueTimerEndTime) {
            // V5.55.0: Queue timer active - show queue position
            const pos = queueTimerEndTime.queuePosition || (queueIndex + 1);
            const total = queueTimerEndTime.queueTotal || quickBellQueue.length;
            activeTimerLabel = `Queue (${pos}/${total})`;
            nextBellInfoString = `Timer ${pos} of ${total} in queue.`;
            if (queueRepeatMode === 'times' && queueRepeatTimes > 1) {
                nextBellInfoString += ` Repeat ${queueCurrentRepeat + 1}/${queueRepeatTimes}.`;
            }
        } else {
            activeTimerLabel = effectiveQuickBellEndTime.bellName || "Quick Bell"; // NEW V5.00
            // The "next bell" info should be the next *schedule* bell
            if (scheduleBellObject) {
                // Use (true) to omit seconds if they are 00
                // MODIFICATION in 5.29: Added period at the end
                const namePunctuation = /[.!?]$/.test(scheduleBellObject.name) ? '' : '.';
                nextBellInfoString = `Next bell is ${scheduleBellObject.name} at ${formatTime12Hour(scheduleBellObject.time, true)}${namePunctuation}`;
            } else {
                nextBellInfoString = "No more bells today."; // Already has period
            }
        }
        activeTimerMillis = millisToQuickBell;
        isMuting = false;
    }
    
    // --- 4. Populate Countdown and "Next Bell" Elements ---
    nextBellInfoElement.textContent = nextBellInfoString;

    if (activeTimerLabel) {
        let totalSeconds = Math.max(0, Math.floor(activeTimerMillis / 1000));
        let cdHours = Math.floor(totalSeconds / 3600);
        totalSeconds %= 3600;
        let cdMinutes = Math.floor(totalSeconds / 60);
        let cdSeconds = totalSeconds % 60;
        let countdownString;
        
        if (cdHours > 0) {
            countdownString = `${cdHours}:${String(cdMinutes).padStart(2, '0')}:${String(cdSeconds).padStart(2, '0')}`;
        } else if (cdMinutes > 0 || cdHours > 0) { // Show minutes if 1m or more
            countdownString = `${cdMinutes}:${String(cdSeconds).padStart(2, '0')}`;
        } else {
            countdownString = `${cdSeconds}`;
        }
        countdownElement.textContent = countdownString;
        
        // V5.52.0: Apply countdown warning effect
        const totalSecondsRemaining = Math.max(0, Math.floor(activeTimerMillis / 1000));
        const isQuickBellActive = millisToQuickBell < millisToScheduleBell;
        applyWarningEffect(totalSecondsRemaining, isQuickBellActive);
        
        // Updated 5.26.1 - Add Period context to the label
        let bellLabel = activeTimerLabel;

        // Added in 5.29: Don't add period name if bell name already starts with period name
        const shouldAddPeriod = scheduleBellObject && 
                                scheduleBellObject.periodName && 
                                activeTimerLabel !== "Quick Bell" && 
                                millisToQuickBell >= Infinity &&
                                !activeTimerLabel.startsWith(scheduleBellObject.periodName);
        
        if (shouldAddPeriod) {
            bellLabel = `${scheduleBellObject.periodName}: ${activeTimerLabel}`;
        }
        
        // Smart punctuation: don't add period if label already ends with punctuation
        const hasPunctuation = /[.!?]$/.test(bellLabel);
        const muteText = isMuting ? ' (MUTED)' : '';
        const finalPunctuation = hasPunctuation ? '' : '.';
            
        nextBellElement.textContent = `until ${bellLabel}${muteText}${finalPunctuation}`;
    } else {
        // --- C. No active timer ---
        countdownElement.textContent = "--:--";
        // MODIFICATION: Added period
        nextBellElement.textContent = "until the next bell.";
        
        // V5.52.0: Clear warning effects when no active countdown
        clearWarningEffects();
        
        // "Next Bell" info is already set to "No more bells today."
        // Or, if school is out, scheduleBellObject is the first bell tomorrow.
        if (scheduleBellObject) {
            // MODIFICATION: Added period
            nextBellInfoString = `Next bell is ${scheduleBellObject.name} at ${formatTime12Hour(scheduleBellObject.time, true)}.`;
            nextBellInfoElement.textContent = nextBellInfoString;
        } else {
                nextBellInfoElement.textContent = "No bells scheduled."; // Already has period
        }
    }

    // --- NEW in 4.38: Pre-Bell Wake-up Logic ---
    // If a bell is approaching (under 60s) and we're not in "alert mode",
    // start "pulsing" the silent oscillator to keep the browser awake.
    // MODIFIED in 4.41: Widen window from 60s to 180s (3 minutes)
    if (activeTimerMillis < 180000 && !isOscillatorAlert && keepAliveOscillator) {
        // NEW in 4.41: Added timestamp to log
        const nowStr = formatTime12Hour(currentTimeHHMMSS, false);
        console.log(`Bell approaching. Entering oscillator alert mode. (Actual: ${nowStr})`);
        isOscillatorAlert = true;
        if (oscillatorAlertInterval) clearInterval(oscillatorAlertInterval); // Clear just in case
        
        // "Pulse" the volume of the silent oscillator every 2 seconds
        oscillatorAlertInterval = setInterval(() => {
            if (keepAliveOscillator) {
                // Ramp to slightly "louder" (still inaudible) and back
                keepAliveOscillator.volume.rampTo(-99, 0.2);
                setTimeout(() => {
                    if (keepAliveOscillator) {
                        keepAliveOscillator.volume.rampTo(-100, 0.2);
                    }
                }, 1000); // 1s at -99, 1s at -100
            }
        }, 2000);
    } 
    // If the next bell is far away and we're still in "alert mode", stop.
    // MODIFIED in 4.41: Widen window from 60s to 180s (3 minutes)
    else if (activeTimerMillis > 180000 && isOscillatorAlert && keepAliveOscillator) {
        // NEW in 4.41: Added timestamp to log
        const nowStr = formatTime12Hour(currentTimeHHMMSS, false);
        console.log(`Bell has passed. Exiting oscillator alert mode. (Actual: ${nowStr})`);
        isOscillatorAlert = false;
        if (oscillatorAlertInterval) {
            clearInterval(oscillatorAlertInterval);
            oscillatorAlertInterval = null;
        }
        // Ensure volume is reset
        keepAliveOscillator.volume.value = -100;
    }

    // --- 5. Ring Logic (MODIFIED in 4.35: Missed Bell Recovery) ---
    
    // A. Check if the day has rolled over. If so, clear the timestamp.
    const newDay = now.getDay();
    if (newDay !== currentDay) {
        console.log("Day has changed. Resetting missed bell check.");
        lastClockCheckTimestamp = 0; // Force reset
        currentDay = newDay;
        clearOldSkippedBells(); // V5.47.9: Clear skipped bells from previous day
        applyCalendarSchedule('day-change'); // V5.73.0 (parked: gated off inside)
        recalculateAndRenderAll(); // V5.74.0: expire yesterday's emergency shift
    }

    // B. On first run, just set the timestamp and wait for the next second.
    if (lastClockCheckTimestamp === 0) {
        lastClockCheckTimestamp = nowTimestamp;
    } else if (nowTimestamp > lastClockCheckTimestamp) {
        // V5.48: Check if tab was asleep for a long time (more than 2 minutes)
        const timeSinceLastCheck = nowTimestamp - lastClockCheckTimestamp;
        const wasTabAsleep = timeSinceLastCheck > 120000; // 2 minutes
        
        // C. Find all bells that *should have* rung between the last check and now
        const bellsToRing = allBells.filter(bell => {
            const bellDate = getDateForBellTime(bell.time, now);
            const bellTimestamp = bellDate.getTime();
            
            return bellTimestamp > lastClockCheckTimestamp && // After the last check
                    bellTimestamp <= nowTimestamp;            // and at or before now
        });
        
        if (bellsToRing.length > 0) {
            console.log(`Found ${bellsToRing.length} missed bell(s) to ring.`);
            // Sort them by time
            bellsToRing.sort((a, b) => a.time.localeCompare(b.time));
            
            // V5.48: If tab was asleep and multiple bells missed, show notification
            if (wasTabAsleep && bellsToRing.length > 1) {
                const missedCount = bellsToRing.length;
                const missedNames = bellsToRing.map(b => `${b.name} (${formatTime12Hour(b.time, true)})`);
                
                // Show user message about missed bells
                showUserMessage(`Tab was asleep - ${missedCount} bell${missedCount > 1 ? 's' : ''} missed`);
                
                // Log details to console
                console.log('Missed bells while tab was asleep:', missedNames);
                
                // Update status to show missed count
                statusElement.textContent = `${missedCount} bells missed while tab was asleep`;
            }

            // Ring only the MOST RECENT bell (last in sorted array), and only if cooldown passed
            if (nowTimestamp - lastRingTimestamp > RING_COOLDOWN) {
                const bell = bellsToRing[bellsToRing.length - 1];
                const bellId = bell.bellId || getBellId(bell);
                
                // V5.55.0: Check if queue should stop at this bell
                if (queueActive && queueRepeatMode === 'until' && queueUntilBellId === String(bellId)) {
                    console.log('Queue "until" bell reached, stopping queue');
                    cancelQueue();
                }
                
                // V5.55.0: Check if queue is ignoring this bell type
                const isPersonalBell = personalBells.some(pb => getBellId(pb) === bellId || pb.bellId === bellId);
                const isSharedBell = !isPersonalBell;
                
                if (queueActive && queueIgnorePersonal && isPersonalBell) {
                    console.log(`Skipping bell (Queue ignoring personal): ${bell.name}`);
                    if (!wasTabAsleep || bellsToRing.length === 1) {
                        statusElement.textContent = `Queue ignoring: ${bell.name}`;
                    }
                } else if (queueActive && queueIgnoreShared && isSharedBell) {
                    console.log(`Skipping bell (Queue ignoring shared): ${bell.name}`);
                    if (!wasTabAsleep || bellsToRing.length === 1) {
                        statusElement.textContent = `Queue ignoring: ${bell.name}`;
                    }
                } else if (mutedBellIds.has(String(bellId))) {
                    console.log(`Skipping bell (Muted): ${bell.name}`);
                    if (!wasTabAsleep || bellsToRing.length === 1) {
                        statusElement.textContent = `Skipped (Muted): ${bell.name}`;
                    }
                } else if (isBellSkipped(bell)) {
                    // V5.47.9: Skip temporarily skipped bells
                    console.log(`Skipping bell (Skipped): ${bell.name}`);
                    if (!wasTabAsleep || bellsToRing.length === 1) {
                        statusElement.textContent = `Skipped: ${bell.name}`;
                    }
                    // Remove from skipped set since it's now passed
                    skippedBellOccurrences.delete(getSkipKey(bell));
                } else {
                    // Only ring if tab wasn't asleep for ages, OR if it's a reasonable catch-up
                    if (!wasTabAsleep || bellsToRing.length <= 3) {
                        ringBell(bell);
                        lastBellRingTime = currentTimeHHMMSS;
                    } else {
                        // Too many missed - don't ring, just notify
                        console.log(`Not ringing ${bell.name} - too many bells missed (${bellsToRing.length})`);
                    }
                }
                lastRingTimestamp = nowTimestamp; // Set cooldown
            }
        }
    }
    
    // D. Always update the timestamp for the next check
    lastClockCheckTimestamp = nowTimestamp;

    // --- Ring Logic (Quick Bell / Queue Timer) ---
    // V5.55.0: Handle both regular quick bells and queue timers
    const activeTimerEndTime = queueActive ? queueTimerEndTime : quickBellEndTime;
    const activeTimerSound = queueActive ? (queueTimerEndTime?.sound || 'ellisBell.mp3') : quickBellSound;
    
    if (activeTimerEndTime && nowTimestamp >= activeTimerEndTime.getTime() && (nowTimestamp - lastRingTimestamp > RING_COOLDOWN)) {
        if (queueActive) {
            console.log(`Ringing Queue Timer ${queueIndex + 1}/${quickBellQueue.length}`);
            ringBell({ name: `Queue Timer ${queueIndex + 1}`, sound: activeTimerSound });
            lastBellRingTime = currentTimeHHMMSS;
            // Advance to next timer in queue
            advanceQueue();
        } else {
            console.log("Ringing Quick Bell");
            ringBell({ name: "Quick Bell", sound: quickBellSound });
            lastBellRingTime = currentTimeHHMMSS; // FIX V5.42: Track ring time for status reset
            // MODIFIED in 4.39: DO NOT set the lastRingTimestamp.
            // This prevents a quick bell from "eating" a nearby schedule bell.
            // lastRingTimestamp = nowTimestamp;
            quickBellEndTime = null; // Clear the quick bell
        }
    }

    // MODIFIED: Reset status text logic
    if (lastBellRingTime && lastBellRingTime !== currentTimeHHMMSS && (nowTimestamp - lastRingTimestamp > RING_COOLDOWN)) {
        lastBellRingTime = null;
        if (isAudioReady) statusElement.textContent = "Monitoring...";
    }

    // --- MODIFIED V5.42.0: Update Visual Cue with proper period boundary detection ---
    try {
        const now = new Date();
        const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        
        let visualHtml = '';
        let visualSource = ''; // For debugging
        let newVisualKey = ''; // Track what visual should be showing
        
        // Get all bells from current schedule, sorted by time
        const allBells = calculatedPeriodsList.flatMap(p => 
            p.bells.map(b => ({ ...b, periodName: p.name }))
        ).sort((a, b) => a.time.localeCompare(b.time));
        
        // Find the most recent bell that has already rung
        const previousBell = allBells
            .filter(b => b.time <= currentTimeStr)
            .sort((a, b) => b.time.localeCompare(a.time))[0]; // Most recent first
        
        // Find the next upcoming bell
        const nextBell = allBells
            .filter(b => b.time > currentTimeStr)
            .sort((a, b) => a.time.localeCompare(b.time))[0];
        
        // Priority 1: "After" visual from previous bell
        // Shows from when the bell rang until the next bell rings
        if (previousBell && previousBell.visualMode === 'after' && previousBell.visualCue) {
            visualHtml = getVisualHtml(previousBell.visualCue, previousBell.name);
            visualSource = `After: ${previousBell.name}`;
            newVisualKey = `after:${previousBell.bellId}`;
        }
        
        // Priority 2: "Before" visual from upcoming bell
        // Shows during countdown to the bell
        if (!visualHtml && nextBell && nextBell.visualMode === 'before' && nextBell.visualCue) {
            visualHtml = getVisualHtml(nextBell.visualCue, nextBell.name);
            visualSource = `Before: ${nextBell.name}`;
            newVisualKey = `before:${nextBell.bellId}`;
        }
        
        // Priority 3: Queue Timer or Quick Bell (if active)
        if (!visualHtml && millisToQuickBell < Infinity) {
            // V5.55.0: Check for queue first
            if (queueActive) {
                visualHtml = getQueueVisualHtml();
                visualSource = `Queue Timer (${queueIndex + 1}/${quickBellQueue.length})`;
                newVisualKey = `queue:${queueIndex}:${queueCurrentRepeat}`;
            } else {
                const activeCustomBell = customQuickBells.find(b => b && b.isActive !== false && b.name === activeTimerLabel);
                
                if (activeCustomBell) {
                    const visualCue = activeCustomBell.visualCue || `[CUSTOM_TEXT] ${activeCustomBell.iconText}|${activeCustomBell.iconBgColor}|${activeCustomBell.iconFgColor}`;
                    visualHtml = getVisualHtml(visualCue, activeCustomBell.name);
                    visualSource = `Quick Bell: ${activeCustomBell.name}`;
                    newVisualKey = `quickbell:${activeCustomBell.id}`;
                } else {
                    visualHtml = `<div class="w-full h-full p-8 text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-full h-full"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg></div>`;
                    visualSource = 'Quick Bell (generic)';
                    newVisualKey = 'quickbell:generic';
                }
            }
        }
        
        // Priority 4 & 5: Period visual OR Passing period
        // V5.42.0: Now based on TIME within period boundaries, not next bell association
        if (!visualHtml) {
            const currentPeriod = findCurrentPeriodByTime(currentTimeStr, calculatedPeriodsList);
            
            if (currentPeriod) {
                // Inside a period - show period visual
                const visualKey = getVisualOverrideKey(activeBaseScheduleId, currentPeriod.name);
                const visualValue = periodVisualOverrides[visualKey] || "";
                visualHtml = getVisualHtml(visualValue, currentPeriod.name);
                visualSource = `Period: ${currentPeriod.name}`;
                newVisualKey = `period:${currentPeriod.name}`;
                currentVisualPeriodName = currentPeriod.name;
            } else {
                // Outside all periods - show passing period visual
                const passingVisual = getPassingPeriodVisualCue();
                visualHtml = getVisualHtml(passingVisual, 'Passing Period');
                visualSource = 'Passing Period';
                newVisualKey = 'passing';
                currentVisualPeriodName = 'Passing Period';
            }
        }
        
        // Only update the DOM if the visual has actually changed
        if (newVisualKey !== currentVisualKey) {
            safeLog.log(`Visual: ${visualSource}`); // V5.61.0: Use safe logging
            visualCueContainer.innerHTML = visualHtml;
            currentVisualKey = newVisualKey;
        }
        
    } catch (e) {
        console.error("Error updating visual cue:", e);
    }
    
    // V5.48: Update Skip/Unskip button visibility
    updateMainPageSkipButtons();
    
    // V5.47.0: Update Picture-in-Picture window if open
    updatePipWindow();
}

// --- NEW: Quick Bell Function (MODIFIED V5.00) ---
function startQuickBell(hours = 0, minutes = 0, seconds = 0, sound, name = "Quick Bell", shouldBroadcast = false) {
    const now = new Date();
    // V5.44.8: Include hours in calculation
    const totalMillis = (hours * 3600000) + (minutes * 60000) + (seconds * 1000);
    
    quickBellEndTime = new Date(now.getTime() + totalMillis);
    document.getElementById('cancel-quick-bell-btn').classList.remove('hidden'); // 5.27: Show cancel button
    // Store the full details of the bell being launched
    quickBellSound = sound || quickBellSoundSelect.value;
    
    // NEW V5.00: Store quick bell name for countdown display
    quickBellEndTime.bellName = name; 
    
    // V5.65.0: Store whether this bell was broadcast (for cancel sync)
    quickBellEndTime.wasBroadcast = shouldBroadcast || broadcastEnabled;

    console.log(`Quick bell set for ${hours}h ${minutes}m ${seconds}s from now. Sound: ${quickBellSound}`);
    
    // V5.65.0: Broadcast to other devices if enabled
    if ((shouldBroadcast || broadcastEnabled) && userId && !isUserAnonymous) {
        broadcastQuickBell('start', hours, minutes, seconds, quickBellSound, name, totalMillis);
    }
    
    updateClock(); // Update display immediately
}

