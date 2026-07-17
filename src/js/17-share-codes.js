// ============================================
// V5.63.0: SHARE CODE FEATURE
// ============================================

/**
 * Generate a random 6-character share code
 */
function generateShareCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0,O,1,I)
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Open the share schedule modal
 */
async function openShareScheduleModal() {
    if (!activePersonalScheduleId) {
        showUserMessage('Please select a personal schedule first', 'error');
        return;
    }
    
    const schedule = allPersonalSchedules.find(s => s.id === activePersonalScheduleId);
    if (!schedule) return;
    
    shareScheduleName.textContent = schedule.name;
    shareScheduleStatus.classList.add('hidden');
    
    // Check if this schedule already has a share code
    try {
        const shareCodesRef = collection(db, 'artifacts', appId, 'public', 'data', 'share_codes');
        const snapshot = await getDocs(shareCodesRef);
        
        let existingCode = null;
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.ownerId === userId && data.scheduleId === activePersonalScheduleId) {
                existingCode = docSnap.id;
            }
        });
        
        if (existingCode) {
            // Show existing code
            shareCodeGenerate.classList.add('hidden');
            shareCodeDisplay.classList.remove('hidden');
            shareCodeValue.value = existingCode;
        } else {
            // Show generate button
            shareCodeGenerate.classList.remove('hidden');
            shareCodeDisplay.classList.add('hidden');
        }
        
        shareScheduleModal.classList.remove('hidden');
    } catch (error) {
        console.error('Error checking share code:', error);
        showUserMessage('Error checking share status', 'error');
    }
}

/**
 * Generate a new share code for the current schedule
 */
async function createShareCode() {
    if (!activePersonalScheduleId || !userId) return;
    
    const schedule = allPersonalSchedules.find(s => s.id === activePersonalScheduleId);
    if (!schedule) return;
    
    try {
        shareScheduleStatus.textContent = 'Generating...';
        shareScheduleStatus.classList.remove('hidden');
        
        // Generate unique code (check for collisions)
        let code = generateShareCode();
        let attempts = 0;
        while (attempts < 10) {
            const codeDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'share_codes', code));
            if (!codeDoc.exists()) break;
            code = generateShareCode();
            attempts++;
        }
        
        // Create the share code document
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'share_codes', code), {
            ownerId: userId,
            scheduleId: activePersonalScheduleId,
            scheduleName: schedule.name,
            ownerName: auth.currentUser?.displayName || 'Anonymous',
            createdAt: new Date().toISOString()
        });
        
        // Update UI
        shareCodeValue.value = code;
        shareCodeGenerate.classList.add('hidden');
        shareCodeDisplay.classList.remove('hidden');
        shareScheduleStatus.textContent = 'Share code created!';
        
        showUserMessage(`Share code created: ${code}`, 'success');
        
    } catch (error) {
        console.error('Error creating share code:', error);
        shareScheduleStatus.textContent = 'Error creating share code';
        shareScheduleStatus.classList.remove('hidden');
    }
}

/**
 * Copy share code to clipboard
 */
async function copyShareCodeToClipboard() {
    const code = shareCodeValue.value;
    try {
        await navigator.clipboard.writeText(code);
        showUserMessage('Share code copied!', 'success');
    } catch (error) {
        // Fallback
        shareCodeValue.select();
        document.execCommand('copy');
        showUserMessage('Share code copied!', 'success');
    }
}

/**
 * Revoke (delete) a share code
 */
async function revokeShareCode() {
    const code = shareCodeValue.value;
    if (!code) return;
    
    if (!confirm('Revoke this share code? Anyone following your schedule will lose access.')) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'share_codes', code));
        
        shareCodeGenerate.classList.remove('hidden');
        shareCodeDisplay.classList.add('hidden');
        shareCodeValue.value = '';
        
        showUserMessage('Share code revoked', 'success');
    } catch (error) {
        console.error('Error revoking share code:', error);
        showUserMessage('Error revoking share code', 'error');
    }
}

/**
 * Look up a share code as user types
 */
async function lookupShareCode(code) {
    code = code.toUpperCase().trim();
    
    if (code.length !== 6) {
        shareCodePreview.classList.add('hidden');
        enterShareCodeSubmit.disabled = true;
        currentShareCodeLookup = null;
        return;
    }
    
    try {
        enterShareCodeStatus.textContent = 'Looking up...';
        enterShareCodeStatus.classList.remove('hidden');
        
        const codeDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'share_codes', code));
        
        if (!codeDoc.exists()) {
            enterShareCodeStatus.textContent = 'Share code not found';
            enterShareCodeStatus.className = 'text-red-600 text-sm mt-4';
            shareCodePreview.classList.add('hidden');
            enterShareCodeSubmit.disabled = true;
            currentShareCodeLookup = null;
            return;
        }
        
        const data = codeDoc.data();
        
        // Check if already following
        const alreadyFollowing = followingSchedules.some(f => 
            f.ownerId === data.ownerId && f.scheduleId === data.scheduleId
        );
        
        if (alreadyFollowing) {
            enterShareCodeStatus.textContent = "You're already following this schedule";
            enterShareCodeStatus.className = 'text-yellow-600 text-sm mt-4';
            shareCodePreview.classList.add('hidden');
            enterShareCodeSubmit.disabled = true;
            currentShareCodeLookup = null;
            return;
        }
        
        // Check if it's own schedule
        if (data.ownerId === userId) {
            enterShareCodeStatus.textContent = 'This is your own schedule!';
            enterShareCodeStatus.className = 'text-yellow-600 text-sm mt-4';
            shareCodePreview.classList.add('hidden');
            enterShareCodeSubmit.disabled = true;
            currentShareCodeLookup = null;
            return;
        }
        
        // Show preview
        shareCodePreviewName.textContent = data.scheduleName;
        shareCodePreviewOwner.textContent = `Shared by: ${data.ownerName || 'Unknown'}`;
        shareCodePreview.classList.remove('hidden');
        enterShareCodeStatus.classList.add('hidden');
        enterShareCodeSubmit.disabled = false;
        
        currentShareCodeLookup = {
            code: code,
            ...data
        };
        
    } catch (error) {
        console.error('Error looking up share code:', error);
        enterShareCodeStatus.textContent = 'Error looking up code';
        enterShareCodeStatus.className = 'text-red-600 text-sm mt-4';
        enterShareCodeSubmit.disabled = true;
    }
}

/**
 * Follow a schedule from a share code
 */
async function followSchedule() {
    if (!currentShareCodeLookup || !userId) return;
    
    try {
        enterShareCodeStatus.textContent = 'Following...';
        enterShareCodeStatus.className = 'text-blue-600 text-sm mt-4';
        enterShareCodeStatus.classList.remove('hidden');
        
        // Add to following collection
        const followingRef = collection(db, 'artifacts', appId, 'users', userId, 'following');
        await addDoc(followingRef, {
            shareCode: currentShareCodeLookup.code,
            ownerId: currentShareCodeLookup.ownerId,
            scheduleId: currentShareCodeLookup.scheduleId,
            scheduleName: currentShareCodeLookup.scheduleName,
            ownerName: currentShareCodeLookup.ownerName,
            addedAt: new Date().toISOString()
        });
        
        showUserMessage(`Now following: ${currentShareCodeLookup.scheduleName}`, 'success');
        
        // Close modal and refresh
        enterShareCodeModal.classList.add('hidden');
        enterShareCodeForm.reset();
        shareCodePreview.classList.add('hidden');
        currentShareCodeLookup = null;
        
        // Reload following list
        await loadFollowingSchedules();
        updateFollowingButton();
        renderScheduleSelector();
        
    } catch (error) {
        console.error('Error following schedule:', error);
        enterShareCodeStatus.textContent = 'Error following schedule';
        enterShareCodeStatus.className = 'text-red-600 text-sm mt-4';
    }
}

/**
 * Unfollow a schedule
 */
async function unfollowSchedule(followDocId, scheduleName) {
    if (!confirm(`Stop following "${scheduleName}"?`)) return;
    
    try {
        // Check if we're currently viewing this schedule
        const currentSelection = scheduleSelector.value;
        const isViewingUnfollowed = currentSelection.startsWith('following-') && 
            followingSchedules.find(f => f.docId === followDocId && 
                currentSelection === `following-${f.ownerId}-${f.scheduleId}`);
        
        await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'following', followDocId));
        
        showUserMessage(`Unfollowed: ${scheduleName}`, 'success');
        
        // Reload
        await loadFollowingSchedules();
        updateFollowingButton();
        renderScheduleSelector();
        renderFollowingList();
        
        // If we were viewing the unfollowed schedule, switch to first available
        if (isViewingUnfollowed) {
            const firstOption = scheduleSelector.querySelector('option:not([disabled])');
            if (firstOption && firstOption.value) {
                setActiveSchedule(firstOption.value);
            }
        }
        
    } catch (error) {
        console.error('Error unfollowing:', error);
        showUserMessage('Error unfollowing schedule', 'error');
    }
}

/**
 * Load all schedules the user is following
 */
async function loadFollowingSchedules() {
    if (!userId) {
        followingSchedules = [];
        return;
    }
    
    try {
        const followingRef = collection(db, 'artifacts', appId, 'users', userId, 'following');
        const snapshot = await getDocs(followingRef);
        
        followingSchedules = [];
        snapshot.forEach(docSnap => {
            followingSchedules.push({
                docId: docSnap.id,
                ...docSnap.data()
            });
        });
        
        console.log(`Loaded ${followingSchedules.length} following schedules`);
        
    } catch (error) {
        console.error('Error loading following schedules:', error);
        followingSchedules = [];
    }
}

/**
 * Update the "Manage Followed Schedules" button text with count
 */
function updateFollowingButton() {
    if (manageFollowingBtn) {
        const count = followingSchedules.length;
        manageFollowingBtn.textContent = count > 0 
            ? `👥 Manage Followed Schedules (${count})`
            : `👥 Manage Followed Schedules`;
    }
}

/**
 * Render the following list in the manage modal
 */
function renderFollowingList() {
    if (!followingList) return;
    
    if (followingSchedules.length === 0) {
        followingList.innerHTML = '<p class="text-gray-500 text-center py-4">You\'re not following any schedules yet.</p>';
        return;
    }
    
    followingList.innerHTML = followingSchedules.map(f => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
                <p class="font-semibold text-gray-800">${f.scheduleName}</p>
                <p class="text-sm text-gray-500">by ${f.ownerName || 'Unknown'}</p>
            </div>
            <div class="flex gap-2">
                <button type="button" onclick="duplicateFollowedSchedule('${f.ownerId}', '${f.scheduleId}', '${f.scheduleName.replace(/'/g, "\\'")}')" 
                        class="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200" title="Duplicate as your own">
                    📋 Copy
                </button>
                <button type="button" onclick="unfollowSchedule('${f.docId}', '${f.scheduleName.replace(/'/g, "\\'")}')" 
                        class="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200" title="Unfollow">
                    ✕
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Duplicate a followed schedule as your own personal schedule
 */
async function duplicateFollowedSchedule(ownerId, scheduleId, scheduleName) {
    if (!userId) return;
    
    const newName = prompt('Name for your copy:', `${scheduleName} (Copy)`);
    if (!newName) return;
    
    try {
        showUserMessage('Duplicating schedule...', 'info');
        
        // Load the source schedule
        const sourceRef = doc(db, 'artifacts', appId, 'users', ownerId, 'personal_schedules', scheduleId);
        const sourceSnap = await getDoc(sourceRef);
        
        if (!sourceSnap.exists()) {
            showUserMessage('Source schedule not found', 'error');
            return;
        }
        
        const sourceData = sourceSnap.data();
        
        // Create new schedule with copied data
        const newScheduleRef = doc(collection(db, 'artifacts', appId, 'users', userId, 'personal_schedules'));
        
        await setDoc(newScheduleRef, {
            name: newName,
            baseScheduleId: sourceData.baseScheduleId || null,
            isStandalone: sourceData.isStandalone || false,
            periods: sourceData.periods || [],
            bellOverrides: {}, // Start fresh - don't copy overrides
            passingPeriodVisual: sourceData.passingPeriodVisual || null,
            createdAt: new Date().toISOString(),
            copiedFrom: {
                ownerId: ownerId,
                scheduleId: scheduleId,
                scheduleName: scheduleName
            }
        });
        
        showUserMessage(`Created: ${newName}`, 'success');
        
        // Close modal if open
        manageFollowingModal?.classList.add('hidden');
        
    } catch (error) {
        console.error('Error duplicating schedule:', error);
        showUserMessage('Error duplicating schedule', 'error');
    }
}

/**
 * Open the manage following modal
 */
function openManageFollowingModal() {
    renderFollowingList();
    manageFollowingModal.classList.remove('hidden');
}

/**
 * Open the enter share code modal
 */
function openEnterShareCodeModal() {
    enterShareCodeForm.reset();
    shareCodePreview.classList.add('hidden');
    enterShareCodeStatus.classList.add('hidden');
    enterShareCodeSubmit.disabled = true;
    currentShareCodeLookup = null;
    enterShareCodeModal.classList.remove('hidden');
    enterShareCodeInput.focus();
}

// ============================================
// END V5.63.0: SHARE CODE FEATURE
// ============================================
