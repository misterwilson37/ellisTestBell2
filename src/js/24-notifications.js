// ============================================================
// V5.78.0: WEB NOTIFICATION BACKUP RING
// A permission-gated system notification that fires alongside the audio
// bell — the second channel for when a tab is throttled in the background
// or audio fails silently. Every ring path (scheduled bells, missed-bell
// recovery, queue timers, quick bells) funnels through ringBell(), so one
// hook in ringBell covers them all — and because callers check mutes
// BEFORE calling ringBell, notifications automatically respect mutes.
//
// Deliberate decisions (documented so nobody "improves" them blind):
//  - OPT-IN, PER-DEVICE (localStorage), not cloud-synced. The original
//    sketch said "persist via preferences cloud sync," but Notification
//    permission is inherently per-browser-per-device — a synced ON that
//    follows you to a device that never granted permission would just be
//    a toggle that lies. Per-device keeps the toggle truthful.
//  - Fires ONLY when the tab is hidden (document.hidden). When the tab is
//    visible, the teacher already gets audio + the visual cue; an OS
//    notification on top is noise. The backup channel exists for the
//    backgrounded case.
//  - Failures are silent (a backup channel must not create foreground
//    noise); the toggle reflects reality (turns itself off if permission
//    was revoked at the browser level).
// ============================================================

let bellNotificationsEnabled = false;
try {
    bellNotificationsEnabled = localStorage.getItem('bellNotificationsEnabled') === 'true';
} catch (e) { /* storage unavailable — stays off */ }

function notificationsSupported() {
    return typeof Notification !== 'undefined';
}

function refreshNotificationToggleUi() {
    const btn = document.getElementById('bell-notifications-toggle');
    if (!btn) return;
    if (!notificationsSupported()) {
        btn.textContent = '🔕 Notifications unsupported';
        btn.disabled = true;
        return;
    }
    const effective = bellNotificationsEnabled && Notification.permission === 'granted';
    btn.textContent = effective ? '🔔 Notifications: On' : '🔕 Notifications: Off';
    btn.title = effective
        ? 'System notifications fire when this tab is in the background. Click to turn off.'
        : 'Also ring via a system notification when this tab is in the background. Click to enable.';
}

async function toggleBellNotifications() {
    if (!notificationsSupported()) return;
    try {
        if (bellNotificationsEnabled && Notification.permission === 'granted') {
            bellNotificationsEnabled = false;
        } else {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                bellNotificationsEnabled = true;
                // Immediate proof-of-life so the teacher knows what it looks like
                new Notification('Ellis Web Bell', {
                    body: 'Backup notifications are on. You\u2019ll get one like this when a bell rings while this tab is in the background.',
                    icon: '/icon-192.png',
                    tag: 'ellis-bell-test'
                });
            } else {
                bellNotificationsEnabled = false;
                showUserMessage('Notifications are blocked for this site in your browser settings. Allow them there, then try again.', 'Notifications');
            }
        }
        try { localStorage.setItem('bellNotificationsEnabled', String(bellNotificationsEnabled)); } catch (e) {}
    } catch (e) {
        console.warn('[Notify] toggle failed:', e);
    }
    refreshNotificationToggleUi();
}

/**
 * Called from ringBell() for every bell that actually rings.
 * Silent no-op unless: enabled + permission granted + tab hidden.
 */
function maybeNotifyBell(bell) {
    try {
        if (!bellNotificationsEnabled || !notificationsSupported()) return;
        if (Notification.permission !== 'granted') {
            // Permission was revoked at the browser level — make the toggle truthful.
            bellNotificationsEnabled = false;
            try { localStorage.setItem('bellNotificationsEnabled', 'false'); } catch (e) {}
            refreshNotificationToggleUi();
            return;
        }
        if (!document.hidden) return; // visible tab already has audio + visuals
        new Notification(`\ud83d\udd14 ${bell.name}`, {
            body: bell.time ? `Scheduled for ${formatTime12Hour(bell.time, true)}` : 'Bell',
            icon: '/icon-192.png',
            tag: 'ellis-bell-ring' // coalesce rapid-fire rings into one
        });
    } catch (e) {
        console.log('[Notify] skipped:', e.message);
    }
}

document.getElementById('bell-notifications-toggle')?.addEventListener('click', toggleBellNotifications);
refreshNotificationToggleUi();
