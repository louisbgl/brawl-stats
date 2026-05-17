// Auto-refresh module - updates timestamps and polls for new data
// Depends on: data.js, battlelog-data.js

const AutoRefreshManager = {
    intervalId: null,
    isEnabled: false,
    lastSnapshotTime: null,
    lastBattlelogTime: null,

    async init() {
        // Fetch initial timestamps from metadata files
        await this.fetchInitialTimestamps();

        // Start updates every 60s
        this.start();

        // Pause when tab is hidden (save bandwidth)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        });
    },

    async fetchInitialTimestamps() {
        // Fetch snapshot metadata
        try {
            const response = await fetch('data/snapshots/_last_updated.json?_=' + Date.now());
            if (response.ok) {
                const metadata = await response.json();
                this.lastSnapshotTime = metadata.last_collection;
            }
        } catch (error) {
            console.warn('[AutoRefresh] Could not fetch initial snapshot metadata');
        }

        // Fetch battlelog metadata
        try {
            const response = await fetch('data/battlelogs/_last_updated.json?_=' + Date.now());
            if (response.ok) {
                const metadata = await response.json();
                this.lastBattlelogTime = metadata.last_collection;
            }
        } catch (error) {
            console.warn('[AutoRefresh] Could not fetch initial battlelog metadata');
        }

        console.log('[AutoRefresh] Initial timestamps:', {
            snapshots: this.lastSnapshotTime,
            battlelogs: this.lastBattlelogTime
        });
    },

    start() {
        if (this.intervalId) return; // Already running

        this.isEnabled = true;

        // Every 60 seconds: update timestamps + check for new data
        this.intervalId = setInterval(() => {
            this.tick();
        }, 60000);

        console.log('[AutoRefresh] Started (60s interval)');
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

        // Tick immediately on resume
        this.tick();

        // Restart interval
        this.intervalId = setInterval(() => {
            this.tick();
        }, 60000);

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

    async tick() {
        // Update timestamp display
        this.updateTimestamps();

        // Check for new data
        await this.checkForNewData();
    },

    updateTimestamps() {
        // Refresh the timestamp display - calls the function from app.js
        if (typeof updateLastUpdatedDisplay === 'function') {
            updateLastUpdatedDisplay();
        }
    },

    async checkForNewData() {
        try {
            // Check both metadata files in parallel
            const [snapshotChanged, battlelogChanged] = await Promise.all([
                this.checkSnapshotMetadata(),
                this.checkBattlelogMetadata()
            ]);

            if (snapshotChanged || battlelogChanged) {
                console.log('[AutoRefresh] New data detected:', {
                    snapshots: snapshotChanged,
                    battlelogs: battlelogChanged
                });
                this.reloadPage();
            }
        } catch (error) {
            console.error('[AutoRefresh] Error checking for updates:', error);
        }
    },

    async checkSnapshotMetadata() {
        try {
            const response = await fetch('data/snapshots/_last_updated.json?_=' + Date.now());
            if (!response.ok) return false;

            const metadata = await response.json();
            const newTime = metadata.last_collection;

            // Compare as timestamps (handles timezone differences)
            const newTimestamp = new Date(newTime).getTime();
            const oldTimestamp = new Date(this.lastSnapshotTime).getTime();

            if (newTimestamp !== oldTimestamp) {
                this.lastSnapshotTime = newTime;
                return true;
            }
        } catch (error) {
            // Silent fail - metadata file might not exist yet
        }
        return false;
    },

    async checkBattlelogMetadata() {
        try {
            const response = await fetch('data/battlelogs/_last_updated.json?_=' + Date.now());
            if (!response.ok) return false;

            const metadata = await response.json();
            const newTime = metadata.last_collection;

            // Compare as timestamps (handles timezone differences)
            const newTimestamp = new Date(newTime).getTime();
            const oldTimestamp = new Date(this.lastBattlelogTime).getTime();

            if (newTimestamp !== oldTimestamp) {
                this.lastBattlelogTime = newTime;
                return true;
            }
        } catch (error) {
            // Silent fail - metadata file might not exist yet
        }
        return false;
    },

    reloadPage() {
        console.log('[AutoRefresh] Reloading page with new data...');
        window.location.reload();
    }
};
