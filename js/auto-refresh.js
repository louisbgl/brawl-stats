// Auto-refresh module - updates timestamps and polls for new data
// Depends on: data.js, battlelog-data.js

const AutoRefreshManager = {
    timestampIntervalId: null,
    isEnabled: false,

    init() {
        // Start timestamp updates every 60s
        this.start();

        // Pause when tab is hidden (save CPU)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        });
    },

    start() {
        if (this.timestampIntervalId) return; // Already running

        this.isEnabled = true;

        // Update timestamps every 60 seconds
        this.timestampIntervalId = setInterval(() => {
            this.updateTimestamps();
        }, 60000);

        console.log('[AutoRefresh] Started timestamp updates every 60s');
    },

    pause() {
        if (!this.timestampIntervalId) return;

        clearInterval(this.timestampIntervalId);
        this.timestampIntervalId = null;
        console.log('[AutoRefresh] Paused (tab hidden)');
    },

    resume() {
        if (!this.isEnabled) return;
        if (this.timestampIntervalId) return; // Already running

        // Update immediately on resume
        this.updateTimestamps();

        // Restart interval
        this.timestampIntervalId = setInterval(() => {
            this.updateTimestamps();
        }, 60000);

        console.log('[AutoRefresh] Resumed (tab visible)');
    },

    stop() {
        if (this.timestampIntervalId) {
            clearInterval(this.timestampIntervalId);
            this.timestampIntervalId = null;
        }
        this.isEnabled = false;
        console.log('[AutoRefresh] Stopped');
    },

    updateTimestamps() {
        // Just refresh the timestamp display - calls the function from app.js
        if (typeof updateLastUpdatedDisplay === 'function') {
            updateLastUpdatedDisplay();
        }
    }
};
