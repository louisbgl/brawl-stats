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

        // 5. Render default tab (Overview)
        if (typeof OverviewManager !== 'undefined') {
            OverviewManager.render();
        }

        // 5. Background data loads (optional for v2 - achievements)
        DataLoader.loadAchievements().then((achievements) => {
            console.log('Background achievements load complete:', achievements.length, 'events');
            // Could update achievement count here if needed
        });

        // 6. Setup tab navigation
        setupTabNavigation();

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
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));

            // Add active class to clicked tab
            tab.classList.add('active');

            // Show corresponding content
            const tabName = tab.dataset.tab;
            const content = document.getElementById(tabName);
            if (content) {
                content.classList.add('active');
            }

            // Trigger tab-specific loading
            switch(tabName) {
                case 'overview':
                    if (typeof OverviewManager !== 'undefined') {
                        OverviewManager.render();
                    }
                    break;
                case 'player':
                    console.log('Players tab - not implemented yet');
                    break;
                case 'achievements':
                    if (typeof AchievementsManager !== 'undefined') {
                        AchievementsManager.render();
                    }
                    break;
                case 'battles':
                    console.log('Battles tab - not implemented yet');
                    break;
            }
        });
    });
}
