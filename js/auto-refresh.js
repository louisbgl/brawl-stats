// Auto-refresh module - polls for new data and reloads without page refresh
// Depends on: data.js, battlelog-data.js

const AutoRefreshManager = {
    pollInterval: 60000, // 60 seconds
    intervalId: null,
    lastSnapshotTime: null,
    lastBattlelogTime: null,
    isEnabled: false,

    init() {
        // Store initial timestamps
        this.lastSnapshotTime = DataManager.latestData?.timestamp;
        this.lastBattlelogTime = BattlelogDataManager.getLastCollectionTime();

        // Start polling
        this.start();

        // Pause polling when tab is hidden (save bandwidth)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        });
    },

    start() {
        if (this.intervalId) return; // Already running

        this.isEnabled = true;
        this.intervalId = setInterval(() => this.checkForUpdates(), this.pollInterval);
        console.log('[AutoRefresh] Started polling every 60s');
    },

    pause() {
        if (!this.intervalId) return;

        clearInterval(this.intervalId);
        this.intervalId = null;
        console.log('[AutoRefresh] Paused (tab hidden)');
    },

    resume() {
        if (!this.isEnabled) return;
        if (this.intervalId) return; // Already running

        // Check immediately on resume
        this.checkForUpdates();

        // Restart interval
        this.intervalId = setInterval(() => this.checkForUpdates(), this.pollInterval);
        console.log('[AutoRefresh] Resumed (tab visible)');
    },

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isEnabled = false;
        console.log('[AutoRefresh] Stopped');
    },

    async checkForUpdates() {
        try {
            // Check both metadata files in parallel
            const [snapshotChanged, battlelogChanged] = await Promise.all([
                this.checkSnapshotUpdate(),
                this.checkBattlelogUpdate()
            ]);

            if (snapshotChanged || battlelogChanged) {
                console.log('[AutoRefresh] New data detected:', {
                    snapshots: snapshotChanged,
                    battlelogs: battlelogChanged
                });

                // Reload data and refresh UI
                await this.reloadData(snapshotChanged, battlelogChanged);
            }
        } catch (error) {
            console.error('[AutoRefresh] Error checking for updates:', error);
        }
    },

    async checkSnapshotUpdate() {
        try {
            const response = await fetch('data/snapshots/_last_updated.json?_=' + Date.now());
            if (!response.ok) return false;

            const metadata = await response.json();
            const newTime = metadata.last_collection;

            if (newTime !== this.lastSnapshotTime) {
                this.lastSnapshotTime = newTime;
                return true;
            }
        } catch (error) {
            console.warn('[AutoRefresh] Failed to check snapshot metadata:', error);
        }
        return false;
    },

    async checkBattlelogUpdate() {
        try {
            const response = await fetch('data/battlelogs/_last_updated.json?_=' + Date.now());
            if (!response.ok) return false;

            const metadata = await response.json();
            const newTime = metadata.last_collection;

            if (newTime !== this.lastBattlelogTime) {
                this.lastBattlelogTime = newTime;
                return true;
            }
        } catch (error) {
            console.warn('[AutoRefresh] Failed to check battlelog metadata:', error);
        }
        return false;
    },

    async reloadData(snapshotsChanged, battlelogsChanged) {
        const updates = [];

        // Reload snapshot data
        if (snapshotsChanged) {
            console.log('[AutoRefresh] Reloading snapshot data...');
            try {
                // Reload latest.json
                const response = await fetch('data/latest.json?_=' + Date.now());
                if (response.ok) {
                    DataManager.latestData = await response.json();
                    updates.push('snapshots');
                }
            } catch (error) {
                console.error('[AutoRefresh] Failed to reload snapshot data:', error);
            }
        }

        // Reload battlelog data
        if (battlelogsChanged) {
            console.log('[AutoRefresh] Reloading battlelog data...');
            try {
                // Clear cache and reload all battlelogs
                BattlelogDataManager.battlelogsCache.clear();
                await BattlelogDataManager.loadAllBattlelogs();
                await BattlelogDataManager.loadMetadata();
                updates.push('battlelogs');
            } catch (error) {
                console.error('[AutoRefresh] Failed to reload battlelog data:', error);
            }
        }

        // Refresh UI
        if (updates.length > 0) {
            this.refreshUI(updates);
            this.showNotification(updates);
        }
    },

    refreshUI(updates) {
        console.log('[AutoRefresh] Refreshing UI for:', updates);

        // Always update header timestamps
        if (typeof updateLastUpdatedDisplay === 'function') {
            updateLastUpdatedDisplay();
        }

        // Get current active tab
        const activeTab = document.querySelector('.tab-content.active')?.id;

        // Refresh relevant components based on what changed and what's visible
        if (updates.includes('snapshots')) {
            // Refresh snapshot-dependent components
            if (activeTab === 'overview') {
                if (typeof displayClubQuickStats === 'function') displayClubQuickStats();
                if (typeof displayClubLeaderboards === 'function') displayClubLeaderboards();
                if (typeof ChartsManager !== 'undefined' && ChartsManager.createTrophyTimeline) {
                    ChartsManager.createTrophyTimeline();
                }
            } else if (activeTab === 'player') {
                // Re-trigger player stats display if a player is selected
                const selectedPlayer = document.getElementById('playerSelect')?.value;
                if (selectedPlayer && typeof PlayerStatsManager !== 'undefined') {
                    const { clubIndex, playerIndex } = JSON.parse(selectedPlayer);
                    PlayerStatsManager.displayPlayerStats(clubIndex, playerIndex);
                }
            } else if (activeTab === 'timelines') {
                // Refresh visible timeline charts
                if (typeof ChartsManager !== 'undefined') {
                    const brawlerSelect = document.getElementById('trophyBrawlerSelect')?.value || '';
                    const viewToggle = document.querySelector('.view-toggle.active')?.id;
                    const trophyView = viewToggle === 'trophyViewBattles' ? 'battles' : 'daily';
                    ChartsManager.createBrawlerTrophyTimeline(brawlerSelect, trophyView);
                    ChartsManager.createWinsTimeline(document.getElementById('gamemodeSelect')?.value || '');
                    ChartsManager.createCollectionTimeline();
                    ChartsManager.createMaxedTimeline();
                    ChartsManager.createPrestigeTimeline();
                }
            }
        }

        if (updates.includes('battlelogs')) {
            // Refresh battlelog-dependent components
            if (activeTab === 'overview') {
                if (typeof displayClubQuickStats === 'function') displayClubQuickStats();
                if (typeof displayClubLeaderboards === 'function') displayClubLeaderboards();
            } else if (activeTab === 'battles') {
                // Refresh battles list
                if (typeof BattlesManager !== 'undefined' && BattlesManager.refresh) {
                    BattlesManager.refresh();
                }
            } else if (activeTab === 'player') {
                // Re-trigger player stats display if a player is selected
                const selectedPlayer = document.getElementById('playerSelect')?.value;
                if (selectedPlayer && typeof PlayerStatsManager !== 'undefined') {
                    const { clubIndex, playerIndex } = JSON.parse(selectedPlayer);
                    PlayerStatsManager.displayPlayerStats(clubIndex, playerIndex);
                }
            } else if (activeTab === 'timelines') {
                // Refresh activity/mode popularity charts
                if (typeof ChartsManager !== 'undefined') {
                    const activityRange = document.getElementById('activityTimelineRangeSelect')?.value || 'all';
                    ChartsManager.createActivityTimeline(activityRange);
                    ChartsManager.createModePopularityTimeline();
                }
            }
        }
    },

    showNotification(updates) {
        // Create a simple notification banner
        const existing = document.getElementById('autoRefreshNotification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.id = 'autoRefreshNotification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--accent-green);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            font-size: 0.9rem;
        `;

        const updateText = updates.includes('snapshots') && updates.includes('battlelogs')
            ? 'Snapshots and battlelogs updated!'
            : updates.includes('snapshots')
            ? 'Snapshots updated!'
            : 'Battlelogs updated!';

        notification.textContent = `✓ ${updateText}`;
        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
};

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
