/**
 * Common utilities and configuration
 * Shared constants, helpers, and formatting functions
 */

const GameConfig = {
    // Mode categories
    MODES: {
        TEAM_3V3: ['gemGrab', 'brawlBall', 'bounty', 'heist', 'hotZone', 'knockout', 'siege', 'wipeout'],
        TEAM_5V5: ['brawlBall5V5', 'wipeout5V5', 'knockout5V5', 'deathmatch5v5', 'brawlArena'],
        SHOWDOWN: ['soloShowdown', 'duoShowdown', 'trioShowdown'],
        SPECIAL: ['duels', 'lastStand', 'megaBoss']
    },

    // Mode display names
    MODE_NAMES: {
        'gemGrab': 'Gem Grab',
        'brawlBall': 'Brawl Ball',
        'bounty': 'Bounty',
        'heist': 'Heist',
        'hotZone': 'Hot Zone',
        'knockout': 'Knockout',
        'siege': 'Siege',
        'wipeout': 'Wipeout',
        'brawlBall5V5': 'Brawl Ball 5v5',
        'wipeout5V5': 'Wipeout 5v5',
        'knockout5V5': 'Knockout 5v5',
        'deathmatch5v5': 'Deathmatch 5v5',
        'brawlArena': 'Brawl Arena',
        'soloShowdown': 'Solo Showdown',
        'duoShowdown': 'Duo Showdown',
        'trioShowdown': 'Trio Showdown',
        'duels': 'Duels',
        'lastStand': 'Last Stand',
        'megaBoss': 'Mega Boss'
    },

    // Prestige level to color mapping
    PRESTIGE_COLORS: {
        0: '#FFFFFF', // White
        1: '#9370DB', // Purple
        2: '#FF4444', // Red
        3: '#FFD700', // Yellow
        4: '#FFD700', // Yellow
        5: '#FFD700', // Yellow
        6: '#FFD700', // Yellow
        7: '#FFD700'  // Yellow
    },

    // Helper: Check if mode is team-based
    isTeamMode(mode) {
        return this.MODES.TEAM_3V3.includes(mode) || this.MODES.TEAM_5V5.includes(mode);
    },

    // Helper: Check if mode is 3v3
    is3v3Mode(mode) {
        return this.MODES.TEAM_3V3.includes(mode);
    },

    // Helper: Check if mode is 5v5
    is5v5Mode(mode) {
        return this.MODES.TEAM_5V5.includes(mode);
    },

    // Helper: Check if mode is showdown
    isShowdownMode(mode) {
        return this.MODES.SHOWDOWN.includes(mode);
    },

    // Helper: Get pretty mode name
    getModeName(mode) {
        return this.MODE_NAMES[mode] || mode;
    },

    // Helper: Get prestige color
    getPrestigeColor(level) {
        return this.PRESTIGE_COLORS[level] || '#888888';
    },

    // Battle types
    BATTLE_TYPES: {
        LADDER: 'ranked',           // Trophy-based (shows trophy change)
        RANKED: 'soloRanked',       // Competitive ranked (shows RANKED badge)
        FRIENDLY: 'friendly',       // Casual (shows FRIENDLY badge)
        CHALLENGE: ['challenge', 'championshipChallenge'] // Events (shows CHALLENGE badge)
    },

    // Helper: Check if battle type is ladder (shows trophies)
    isLadderBattle(type) {
        return type === this.BATTLE_TYPES.LADDER;
    },

    // Helper: Get badge text for non-ladder battles
    getBattleTypeBadge(type) {
        if (type === this.BATTLE_TYPES.RANKED) return 'RANKED';
        if (type === this.BATTLE_TYPES.FRIENDLY) return 'FRIENDLY';
        if (this.BATTLE_TYPES.CHALLENGE.includes(type)) return 'CHALLENGE';
        return null; // Ladder battles don't get a badge
    }
};
