// ============================================================
// V5.79.0: STATUS / HEALTH VIEW
// The support script becomes: "open the app, tap the version number in the
// footer, and read me the screen" (or hit Copy Report and paste it).
// Everything a triage conversation needs, in one modal:
//   app version · service worker version + cache (via the GET_VERSION
//   message channel that has existed in service-worker.js since v1.0) ·
//   connectivity + signed-in state · active schedule + any emergency shift
//   · device clock drift (Stage 3's lastClockDriftMs) · notification state
//   · schedule/bell counts.
// Read-only by design: this view diagnoses, it never mutates.
// ============================================================

async function getServiceWorkerVersion() {
    try {
        if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
            return 'not controlling this page';
        }
        return await Promise.race([
            new Promise((resolve) => {
                const channel = new MessageChannel();
                channel.port1.onmessage = (event) => resolve(event.data?.version || 'unknown');
                navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
            }),
            new Promise((resolve) => setTimeout(() => resolve('no response (2s)'), 2000))
        ]);
    } catch (e) {
        return `error: ${e.message}`;
    }
}

async function buildStatusReport() {
    const lines = [];
    const push = (label, value) => lines.push([label, String(value)]);

    push('App version', APP_VERSION);
    push('Service worker', await getServiceWorkerVersion());
    push('Online', navigator.onLine ? 'yes' : 'NO \u2014 offline');
    push('Signed in', userId ? `${currentUserDisplayName || 'anonymous'} (${userId.slice(0, 8)}\u2026)` : 'NO');
    push('Admin mode', document.body.classList.contains('admin-mode') ? 'yes' : 'no');

    const activeShared = allSchedules.find(s => s.id === activeBaseScheduleId);
    push('Active schedule', activePersonalScheduleId
        ? `personal (${activePersonalScheduleId.slice(0, 8)}\u2026)`
        : (activeShared ? activeShared.name : 'none'));
    push('Shared schedules loaded', allSchedules.length);

    const shiftSecs = window.BellEngine.getActiveScheduleShiftSeconds(activeSharedScheduleShift, new Date());
    push('Emergency shift (active schedule)', shiftSecs
        ? `${shiftSecs > 0 ? '+' : ''}${Math.round(shiftSecs / 60)} min (today)`
        : 'none');

    if (lastClockDriftMs === null) {
        push('Device clock drift', 'not measured yet');
    } else {
        const s = Math.round(Math.abs(lastClockDriftMs) / 1000);
        push('Device clock drift',
            s < 5 ? `in sync (\u00b1${s}s)` :
            `${s}s ${lastClockDriftMs > 0 ? 'behind' : 'ahead'} (measured ${lastClockDriftAt.toLocaleTimeString()})`);
    }

    if (typeof Notification === 'undefined') {
        push('Bell notifications', 'unsupported on this browser');
    } else {
        push('Bell notifications', bellNotificationsEnabled && Notification.permission === 'granted'
            ? 'on' : `off (permission: ${Notification.permission})`);
    }

    push('Bells in view', (localSchedule?.length || 0) + (personalBells?.length || 0));
    push('Report time', new Date().toLocaleString());
    return lines;
}

async function openStatusModal() {
    const modal = document.getElementById('status-modal');
    const list = document.getElementById('status-list');
    if (!modal || !list) return;
    list.innerHTML = '<li class="text-sm text-gray-500 py-1">Gathering\u2026</li>';
    modal.classList.remove('hidden');
    const report = await buildStatusReport();
    list.innerHTML = report.map(([label, value]) =>
        `<li class="flex justify-between gap-4 py-1 border-b border-gray-100 text-sm">
            <span class="text-gray-600">${escapeHtml(label)}</span>
            <span class="font-medium text-right">${escapeHtml(value)}</span>
        </li>`).join('');
    // Stash a plain-text copy for the Copy Report button
    modal.dataset.reportText = report.map(([l, v]) => `${l}: ${v}`).join('\n');
}

document.getElementById('app-version-display')?.addEventListener('click', openStatusModal);
document.getElementById('status-close-btn')?.addEventListener('click', () =>
    document.getElementById('status-modal')?.classList.add('hidden'));
document.getElementById('status-copy-btn')?.addEventListener('click', async () => {
    const modal = document.getElementById('status-modal');
    const btn = document.getElementById('status-copy-btn');
    try {
        await navigator.clipboard.writeText(modal?.dataset.reportText || '');
        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Report'; }, 2000); }
    } catch (e) {
        if (btn) btn.textContent = 'Copy failed \u2014 select & copy manually';
    }
});
