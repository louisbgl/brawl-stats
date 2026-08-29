/**
 * DataLoader - Centralized data loading and caching (v2)
 * Handles all aggregated data sources for the Brawl Stats dashboard
 */

const DataLoader = {
    cache: {
        metadata: null,
        clubSummary: null,
        playerIndex: null,
        brawlers: null,
        achievements: null,
        players: {}, // {TAG: {stats, timeline, battleStats, brawlers}}
        battles: {}, // {segment: data}
    },

    /**
     * Initialize critical data (blocks page render)
     * Loads metadata, player index, brawlers reference
     */
    async init() {
        try {
            const [metadata, playerIndex, brawlers] = await Promise.all([
                fetch('data/aggregated/metadata.json').then(r => r.json()),
                fetch('data/aggregated/indexes/players.json').then(r => r.json()),
                fetch('data/aggregated/brawlers.json').then(r => r.json())
            ]);

            this.cache.metadata = metadata;
            this.cache.playerIndex = playerIndex;
            this.cache.brawlers = brawlers;

            return { metadata, playerIndex, brawlers };
        } catch (error) {
            console.error('Failed to load critical data:', error);
            throw error;
        }
    },

    /**
     * Get metadata (instant if cached)
     */
    getMetadata() {
        return this.cache.metadata;
    },

    /**
     * Get club summary (lazy load if needed)
     */
    async getClubSummary() {
        if (this.cache.clubSummary) {
            return this.cache.clubSummary;
        }

        this.cache.clubSummary = await fetch('data/aggregated/club-summary.json').then(r => r.json());

        return this.cache.clubSummary;
    },

    /**
     * Get player index (instant if cached)
     */
    getPlayerIndex() {
        return this.cache.playerIndex;
    },

    /**
     * Get brawlers reference data (instant if cached)
     */
    getBrawlers() {
        return this.cache.brawlers;
    },

    /**
     * Load player-specific data (lazy)
     * @param {string} tag - Player tag (with or without #)
     */
    async loadPlayerData(tag) {
        const cleanTag = tag.replace('#', '');

        if (this.cache.players[cleanTag]) {
            console.log(`✓ Player data for ${tag} (from cache)`);
            return this.cache.players[cleanTag];
        }

        console.log(`Loading player data for ${tag}...`);

        try {
            const [stats, timeline, battleStats, brawlers] = await Promise.all([
                fetch(`data/aggregated/players/${cleanTag}/stats.json`).then(r => r.json()),
                fetch(`data/aggregated/players/${cleanTag}/timeline.json`).then(r => r.json()),
                fetch(`data/aggregated/players/${cleanTag}/battle-stats.json`).then(r => r.json()),
                fetch(`data/aggregated/players/${cleanTag}/brawlers.json`).then(r => r.json())
            ]);

            this.cache.players[cleanTag] = { stats, timeline, battleStats, brawlers };

            console.log(`✓ Player data for ${tag} loaded`);

            return this.cache.players[cleanTag];
        } catch (error) {
            console.error(`Failed to load player data for ${tag}:`, error);
            return null;
        }
    },

    /**
     * Load battle segment (lazy)
     * @param {string} segment - 'recent', 'week-2', 'week-3', 'week-4', 'older'
     */
    async loadBattleSegment(segment) {
        if (this.cache.battles[segment]) {
            return this.cache.battles[segment];
        }

        try {
            const battles = await fetch(`data/aggregated/battles/${segment}.json`).then(r => r.json());
            this.cache.battles[segment] = battles;

            return battles;
        } catch (error) {
            console.error(`Failed to load battle segment ${segment}:`, error);
            return [];
        }
    },

    /**
     * Load all battle segments (lazy)
     */
    async loadAllBattles(progressCallback) {
        const segments = ['recent', 'week-2', 'week-3', 'week-4', 'older'];
        const allBattles = [];

        for (let i = 0; i < segments.length; i++) {
            const battles = await this.loadBattleSegment(segments[i]);
            allBattles.push(...battles);

            if (progressCallback) {
                progressCallback({ loaded: i + 1, total: segments.length });
            }
        }

        console.log('✓ All battle segments loaded:', allBattles.length, 'total battles');

        return allBattles;
    },

    /**
     * Load achievements timeline (lazy)
     */
    async loadAchievements() {
        if (this.cache.achievements) {
            return this.cache.achievements;
        }

        try {
            const achievements = await fetch('data/aggregated/achievements.json').then(r => r.json());
            this.cache.achievements = achievements;

            return achievements;
        } catch (error) {
            console.error('Failed to load achievements:', error);
            return [];
        }
    }
};
