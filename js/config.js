// Configuration constants and utility functions for the frontend

const Config = {
    // Brawlers that currently have buffies available
    BUFFIED_BRAWLERS: [
        "NITA", "CROW", "BULL", "BO", "BIBI", "LEON",
        "SHELLY", "COLT", "SPIKE", "EMZ", "FRANK", "MORTIS"
    ]
};

// Utility functions
const Utils = {
    /**
     * Parse Brawl Stars API battleTime format to JavaScript Date object
     * @param {string} battleTime - Format: "20260324T234127.000Z"
     * @returns {Date|null} - Parsed Date object or null if invalid
     *
     * The Brawl Stars API returns timestamps in a non-standard format:
     * - Format: YYYYMMDDTHHmmss.000Z
     * - Example: 20260324T234127.000Z = 2026-03-24T23:41:27.000Z
     */
    parseBattleTime(battleTime) {
        if (!battleTime || typeof battleTime !== 'string') return null;

        try {
            // Convert 20260324T234127.000Z -> 2026-03-24T23:41:27.000Z
            const year = battleTime.substring(0, 4);
            const month = battleTime.substring(4, 6);
            const day = battleTime.substring(6, 8);
            const hour = battleTime.substring(9, 11);
            const minute = battleTime.substring(11, 13);
            const second = battleTime.substring(13, 15);

            const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
            const date = new Date(isoString);

            // Validate the date is valid
            if (isNaN(date.getTime())) return null;

            return date;
        } catch (error) {
            console.warn('Failed to parse battleTime:', battleTime, error);
            return null;
        }
    },

    /**
     * Get today's date in YYYY-MM-DD format (local timezone)
     * @returns {string} - Today's date string
     */
    getTodayDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * Get yesterday's date in YYYY-MM-DD format (local timezone)
     * @returns {string} - Yesterday's date string
     */
    getYesterdayDateString() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const year = yesterday.getFullYear();
        const month = String(yesterday.getMonth() + 1).padStart(2, '0');
        const day = String(yesterday.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * Format a YYYY-MM-DD date string for display
     * Shows "Today", "Yesterday", or full date
     * @param {string} dateStr - Date in YYYY-MM-DD format
     * @returns {string} - Formatted date string
     */
    formatDateHeader(dateStr) {
        const todayStr = this.getTodayDateString();
        const yesterdayStr = this.getYesterdayDateString();

        if (dateStr === todayStr) {
            return 'Today';
        } else if (dateStr === yesterdayStr) {
            return 'Yesterday';
        } else {
            // Parse for display (use noon to avoid timezone edge cases)
            const date = new Date(dateStr + 'T12:00:00');
            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    },

    /**
     * Format a YYYY-MM-DD date string for day labels (used in battles tab)
     * @param {string} dateStr - Date in YYYY-MM-DD format
     * @returns {string} - Formatted day label
     */
    formatDayLabel(dateStr) {
        const todayStr = this.getTodayDateString();
        const yesterdayStr = this.getYesterdayDateString();

        if (dateStr === todayStr) {
            return 'Today';
        } else if (dateStr === yesterdayStr) {
            return 'Yesterday';
        } else {
            const date = new Date(dateStr + 'T12:00:00');
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
        }
    }
};
