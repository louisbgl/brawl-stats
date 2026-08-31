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
        if (level === 0) return this.PRESTIGE_COLORS[0];
        if (level === 1) return this.PRESTIGE_COLORS[1];
        if (level === 2) return this.PRESTIGE_COLORS[2];
        if (level >= 3) return this.PRESTIGE_COLORS[3]; // 3+ all yellow
        return '#888888';
    },

    // Helper: Format duration in seconds to MM:SS
    formatDuration(seconds) {
        if (!seconds && seconds !== 0) return null;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    // Chart color pool for players without preset colors
    CHART_COLOR_POOL: [
        '#70c7ed', // Cyan
        '#edc770', // Yellow
        '#ed7070', // Red
        '#70ed8f', // Green
        '#8fed70', // Lime
        '#ed8f70', // Orange
        '#708fed', // Blue
        '#c7ed70', // Yellow-green
    ],

    // Preset colors for specific players (tag → color)
    PLAYER_COLORS: {
        '#LLJGJQVY': '#ed70c7', // Pink - Escorte
        '#YR8L09PRC': '#c770ed'  // Purple - JOEL | Mommy
    },

    // Helper: Get chart color for player
    getPlayerChartColor(tag) {
        if (this.PLAYER_COLORS[tag]) {
            return this.PLAYER_COLORS[tag];
        }
        // Hash tag to consistent pool index
        const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return this.CHART_COLOR_POOL[hash % this.CHART_COLOR_POOL.length];
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
    },

    // Leaderboard categories (base categories, brawlers_Xk generated dynamically)
    LEADERBOARD_CATEGORIES: {
        'trophies': 'Trophies',
        'ranked_best': 'Best Rank',
        'winrate': 'Win Rate',
        'total_battles': 'Total Battles',
        'maxed_brawlers': 'Maxed Brawlers'
    },

    // Helper: Get prestige tier label (1 → "Brawler 1k+", 2 → "Brawler 2k+", etc.)
    getPrestigeTierLabel(tier) {
        return `Brawler ${tier}k+`;
    },

    // Helper: Format leaderboard value based on category
    formatLeaderboardValue(category, value) {
        if (value === null || value === undefined) return '—';

        switch(category) {
            case 'trophies':
            case 'total_battles':
            case 'maxed_brawlers':
            case 'brawlers_1k':
            case 'brawlers_2k':
                return value.toLocaleString();
            case 'winrate':
                return `${(value * 100).toFixed(1)}%`;
            case 'ranked_best':
                return this.formatRank(value);
            default:
                return value.toString();
        }
    },

    // Rank tier colors
    RANK_COLORS: {
        'Bronze': '#CD7F32',      // Brown
        'Silver': '#C0C0C0',      // Silver
        'Gold': '#FFD700',        // Gold
        'Diamond': '#B9F2FF',     // Light cyan/diamond blue
        'Mythic': '#9370DB',      // Purple
        'Legendary': '#FF4444',   // Red
        'Master': '#FFA500',      // Orange-yellow
        'Pro': 'linear-gradient(90deg, #FFD700, #7FFF00)' // Yellow to green fade
    },

    // Helper: Get color for rank tier
    getRankColor(rankNum) {
        if (!rankNum || rankNum < 1) return '#888888';

        const tiers = [
            { name: 'Bronze', count: 3 },
            { name: 'Silver', count: 3 },
            { name: 'Gold', count: 3 },
            { name: 'Diamond', count: 3 },
            { name: 'Mythic', count: 3 },
            { name: 'Legendary', count: 3 },
            { name: 'Master', count: 3 },
        ];

        let current = 1;
        for (const tier of tiers) {
            if (rankNum < current + tier.count) {
                return this.RANK_COLORS[tier.name];
            }
            current += tier.count;
        }

        return this.RANK_COLORS['Pro'];
    },

    // Helper: Format rank with color HTML
    formatRankColored(rankNum) {
        if (!rankNum || rankNum < 1) return '—';
        const rankText = this.formatRank(rankNum);
        const color = this.getRankColor(rankNum);
        return `<span style="color: ${color}">${rankText}</span>`;
    },

    // Helper: Format trophy count with yellow color
    formatTrophyColored(trophyCount) {
        return `<span style="color: var(--accent-yellow)">${trophyCount.toLocaleString()}</span>`;
    },

    // Helper: Convert rank number to rank name (Bronze I, Silver II, etc.)
    formatRank(rankNum) {
        if (!rankNum || rankNum < 1) return '—';

        const tiers = [
            { name: 'Bronze', count: 3 },    // 1-3
            { name: 'Silver', count: 3 },    // 4-6
            { name: 'Gold', count: 3 },      // 7-9
            { name: 'Diamond', count: 3 },   // 10-12
            { name: 'Mythic', count: 3 },    // 13-15
            { name: 'Legendary', count: 3 }, // 16-18
            { name: 'Master', count: 3 },    // 19-21
        ];

        let rankName;
        let current = 1;
        for (const tier of tiers) {
            if (rankNum < current + tier.count) {
                const offset = rankNum - current;
                const roman = ['I', 'II', 'III'][offset];
                rankName = `${tier.name} ${roman}`;
                break;
            }
            current += tier.count;
        }

        // Rank 22+ = Pro
        if (!rankName) {
            rankName = 'Pro';
        }

        return rankName;
    }
};
