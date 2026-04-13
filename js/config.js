// Configuration constants and utility functions for the frontend

// ============================================================================
// GAME CONSTANTS - Brawl Stars game mechanics and costs
// ============================================================================

const GameConstants = {
    // Brawlers that currently have buffies available
    BUFFIED_BRAWLERS: [
        "NITA", "CROW", "BULL", "BO", "BIBI", "LEON",
        "SHELLY", "COLT", "SPIKE", "EMZ", "FRANK", "MORTIS"
    ],

    // Power point costs to upgrade each level
    POWER_POINT_COSTS: {
        1: 0,
        2: 20,
        3: 30,
        4: 50,
        5: 80,
        6: 130,
        7: 210,
        8: 340,
        9: 550,
        10: 890,
        11: 1440
    },

    // Coin costs to upgrade each level
    COIN_COSTS: {
        1: 0,
        2: 20,
        3: 35,
        4: 75,
        5: 140,
        6: 290,
        7: 480,
        8: 800,
        9: 1250,
        10: 1875,
        11: 2800
    },

    // Item costs in coins
    ITEM_COSTS: {
        GADGET: 1000,
        STAR_POWER: 2000,
        HYPERCHARGE: 5000
    },

    // Trophy threshold for prestige levels
    PRESTIGE_THRESHOLD: 1000,

    // Criteria for a "maxed" brawler
    MAXED_CRITERIA: {
        power: 11,
        gadgets: 2,
        starPowers: 2,
        hypercharges: 1
    },

    // Color palette for charts (shared across all visualizations)
    COLOR_PALETTE: [
        '#4a9eff', // Blue
        '#9d4edd', // Purple
        '#06d6a0', // Green
        '#ff9f1c', // Orange
        '#ef476f', // Red
        '#118ab2', // Teal
        '#ffd60a'  // Yellow
    ],

    // Prestige level colors for prestige chart
    PRESTIGE_COLORS: {
        0: '#e8eaed',  // White (0-999)
        1: '#9d4edd',  // Purple (1000-1999)
        2: '#ef476f',  // Red (2000-2999)
        3: '#ffd60a',  // Yellow (3000-3999)
        4: '#ff9f1c',  // Orange (4000-4999)
        5: '#06d6a0',  // Green (5000-5999)
        6: '#4a9eff',  // Blue (6000-6999)
        7: '#118ab2'   // Teal (7000+)
    },

    // Game mode colors for mode popularity charts
    // Complete list of all 15 event.mode values found in battle logs
    MODE_COLORS: {
        // Team 3v3 modes
        'gemGrab': '#06d6a0',
        'brawlBall': '#4a9eff',
        'bounty': '#ff9f1c',
        'heist': '#ef476f',
        'hotZone': '#9d4edd',
        'knockout': '#118ab2',
        'siege': '#8338ec',
        'wipeout': '#e63946',
        // Team 5v5 modes
        'brawlBall5V5': '#6bb6ff',
        'wipeout5V5': '#ff5964',
        // Showdown modes
        'showdown': '#ffd60a',
        'soloShowdown': '#ffd60a',
        'duoShowdown': '#ffb703',
        'trioShowdown': '#fb8500',
        // Special modes
        'duels': '#ff006e',
        'lastStand': '#06ffa5',
        'unknown': '#888888'
    },

    // Game mode display names (human-readable)
    MODE_NAMES: {
        // Team 3v3 modes
        'gemGrab': 'Gem Grab',
        'brawlBall': 'Brawl Ball',
        'bounty': 'Bounty',
        'heist': 'Heist',
        'hotZone': 'Hot Zone',
        'knockout': 'Knockout',
        'siege': 'Brawl Arena',
        'wipeout': 'Wipeout',
        // Team 5v5 modes
        'brawlBall5V5': 'Brawl Ball 5v5',
        'wipeout5V5': 'Wipeout 5v5',
        // Showdown modes
        'showdown': 'Showdown',
        'soloShowdown': 'Solo Showdown',
        'duoShowdown': 'Duo Showdown',
        'trioShowdown': 'Trio Showdown',
        // Special modes
        'duels': 'Duels',
        'lastStand': 'Last Stand',
        'unknown': 'Unknown'
    },

    // Game mode categories
    MODE_CATEGORIES: {
        team: ['gemGrab', 'brawlBall', 'bounty', 'heist', 'hotZone', 'knockout', 'siege', 'wipeout'],
        team5v5: ['brawlBall5V5', 'wipeout5V5'],
        showdown: ['soloShowdown', 'duoShowdown', 'trioShowdown'],
        duels: ['duels'],
        pve: ['lastStand']
    },

    /**
     * Get display name for a game mode
     * @param {string} mode - Internal mode name (e.g., 'brawlBall')
     * @returns {string} - Human-readable name (e.g., 'Brawl Ball')
     */
    getModeName(mode) {
        return this.MODE_NAMES[mode] || mode;
    },

    /**
     * Get color for a game mode
     * @param {string} mode - Internal mode name
     * @returns {string} - Hex color code
     */
    getModeColor(mode) {
        return this.MODE_COLORS[mode] || '#888888';
    },

    /**
     * Check if mode is a team mode (3v3 or 5v5)
     * @param {string} mode - Internal mode name
     * @returns {boolean} - True if team mode
     */
    isTeamMode(mode) {
        return this.MODE_CATEGORIES.team.includes(mode) ||
               this.MODE_CATEGORIES.team5v5.includes(mode);
    },

    /**
     * Check if mode is a showdown mode
     * @param {string} mode - Internal mode name
     * @returns {boolean} - True if showdown mode
     */
    isShowdownMode(mode) {
        return this.MODE_CATEGORIES.showdown.includes(mode);
    },

    /**
     * Check if mode is duels
     * @param {string} mode - Internal mode name
     * @returns {boolean} - True if duels mode
     */
    isDuelsMode(mode) {
        return mode === 'duels';
    },

    /**
     * Check if mode is PvE
     * @param {string} mode - Internal mode name
     * @returns {boolean} - True if PvE mode
     */
    isPvEMode(mode) {
        return this.MODE_CATEGORIES.pve.includes(mode);
    }
};

// Legacy export for backwards compatibility
const Config = {
    BUFFIED_BRAWLERS: GameConstants.BUFFIED_BRAWLERS
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
