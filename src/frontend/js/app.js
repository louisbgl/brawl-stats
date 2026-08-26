// Main application initialization
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Show loading screen
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }

    try {
        // 2. Load critical data (blocks render)
        await DataLoader.init();

        // 3. Hide loading screen
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }

        // 4. Update global header data (freshness, tracking since)
        updateHeaderData();

        // 5. Setup tab navigation with routing
        setupTabNavigation();

        // 6. Initialize router (handles initial tab render)
        if (typeof Router !== 'undefined') {
            Router.init();
        }

        // 7. Background data loads (optional for v2 - achievements)
        DataLoader.loadAchievements();

    } catch (error) {
        console.error('Failed to initialize app:', error);
        if (loadingOverlay) {
            loadingOverlay.innerHTML = '<div style="color: var(--accent-pink);">Failed to load data. Please refresh.</div>';
        }
    }
});

function updateHeaderData() {
    const metadata = DataLoader.getMetadata();
    if (!metadata) return;

    // Update freshness indicators
    const freshness = metadata.data_freshness || {};

    const snapshotAge = freshness.snapshot ? getTimeAgo(freshness.snapshot) : '—';
    const snapshotEl = document.getElementById('snapshot-freshness');
    if (snapshotEl) snapshotEl.textContent = snapshotAge;

    const battlelogAge = freshness.battlelog ? getTimeAgo(freshness.battlelog) : '—';
    const battlelogEl = document.getElementById('battlelog-freshness');
    if (battlelogEl) battlelogEl.textContent = battlelogAge;

    // Update tracking since date
    const trackingSince = metadata.tracking_since; // YYYY-MM-DD
    if (trackingSince) {
        const date = new Date(trackingSince);
        const formatted = date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        const trackingEl = document.getElementById('tracking-since');
        if (trackingEl) trackingEl.textContent = `Tracking since ${formatted}`;
    }
}

function getTimeAgo(isoTimestamp) {
    const now = new Date();
    const then = new Date(isoTimestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

function setupTabNavigation() {
    const tabs = document.querySelectorAll('.tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            if (typeof Router !== 'undefined') {
                Router.updateURL(tabName);
            }
        });
    });
}
