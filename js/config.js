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
    }
};
