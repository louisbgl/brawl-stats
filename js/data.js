// Data module - handles loading and caching of all data

// Field compatibility layer - maps snake_case (old) to camelCase (API raw)
const FIELD_COMPAT_MAP = {
    // Player fields
    'victories_3v3': '3vs3Victories',
    'solo_victories': 'soloVictories',
    'duo_victories': 'duoVictories',
    'exp_level': 'expLevel',
    'exp_points': 'expPoints',
    'highest_trophies': 'highestTrophies',
    'total_prestige_level': 'totalPrestigeLevel',
    // Brawler fields
    'prestige_level': 'prestigeLevel',
    'highest_trophies': 'highestTrophies', // same for player/brawler
    // Item ID arrays (extract from full objects)
    'gadget_ids': (obj) => (obj.gadgets || []).map(g => g.id),
    'star_power_ids': (obj) => (obj.starPowers || []).map(sp => sp.id),
    'hyper_charge_ids': (obj) => (obj.hyperCharges || []).map(hc => hc.id),
    'gear_ids': (obj) => (obj.gears || []).map(g => g.id),
};

/**
 * Wrap object with compatibility proxy for snake_case field access.
 * Allows JS code to use old snake_case fields with new camelCase data.
 */
function wrapCompat(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    return new Proxy(obj, {
        get(target, prop) {
            // Direct hit - return as-is
            if (prop in target) return target[prop];

            // Check compatibility map
            if (prop in FIELD_COMPAT_MAP) {
                const mapping = FIELD_COMPAT_MAP[prop];

                // Function mapping (for ID extraction)
                if (typeof mapping === 'function') {
                    return mapping(target);
                }

                // String mapping (field rename)
                if (mapping in target) {
                    return target[mapping];
                }
            }

            return target[prop];
        }
    });
}

const DataManager = {
    latestData: null,
    historicalData: [],
    brawlersData: null,
    achievementsData: [],
    battlelogsCache: new Map(), // tag -> battle items array
    battlelogsMetadata: null,
    playerNameCache: new Map(), // tag -> latest name
    loadingPromises: {
        historical: null,
        achievements: null,
        battlelogs: null
    },

    // Legacy init for backwards compatibility - now only loads critical data
    async init() {
        await this.loadLatest();
        await this.loadBrawlersReference();
        // Historical and achievements loaded in background
    },

    // Load critical data needed for first render
    async initCritical() {
        await this.loadLatest();
        await this.loadBrawlersReference();
    },

    // Load non-critical data in background
    initBackground() {
        // Start loading but don't await - let it happen in background
        this.loadingPromises.historical = this.loadHistorical();
        this.loadingPromises.achievements = this.loadAchievements();
        this.loadingPromises.battlelogs = this.loadBattlelogs();
    },

    // Ensure historical data is loaded (for timelines tab)
    async ensureHistoricalLoaded() {
        // If already loaded, return immediately
        if (this.historicalData.length > 0) {
            return this.historicalData;
        }

        // If background loading started, wait for it
        if (this.loadingPromises.historical) {
            await this.loadingPromises.historical;
        } else {
            // Background loading never started, load now
            await this.loadHistorical();
        }

        return this.historicalData;
    },

    // Ensure achievements data is loaded (for achievements tab)
    async ensureAchievementsLoaded() {
        // If already loaded, return immediately
        if (this.achievementsData.length > 0) {
            return this.achievementsData;
        }

        // If background loading started, wait for it
        if (this.loadingPromises.achievements) {
            await this.loadingPromises.achievements;
        } else {
            // Background loading never started, load now
            await this.loadAchievements();
        }

        return this.achievementsData;
    },

    // Ensure battlelog data is loaded (for battles tab and player stats)
    async ensureBattlelogsLoaded() {
        // If already loaded, return immediately
        if (this.battlelogsCache.size > 0) {
            return this.battlelogsCache;
        }

        // If background loading started, wait for it
        if (this.loadingPromises.battlelogs) {
            await this.loadingPromises.battlelogs;
        } else {
            // Background loading never started, load now
            await this.loadBattlelogs();
        }

        return this.battlelogsCache;
    },

    async loadLatest() {
        const response = await fetch('data/latest.json');
        this.latestData = await response.json();
        this.buildPlayerNameCache();
        return this.latestData;
    },

    buildPlayerNameCache() {
        this.playerNameCache.clear();
        this.latestData.clubs.forEach(club => {
            club.members.forEach(player => {
                this.playerNameCache.set(player.tag, player.name);
            });
        });
        (this.latestData.individual_players || []).forEach(player => {
            this.playerNameCache.set(player.tag, player.name);
        });
    },

    getPlayerName(tag) {
        return this.playerNameCache.get(tag) || 'Unknown';
    },

    async loadHistorical() {
        const dates = [];
        const startDate = new Date('2026-03-14T00:00:00+01:00');
        const today = new Date();

        for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dates.push(`${year}-${month}-${day}`);
        }

        for (const date of dates) {
            try {
                const response = await fetch(`data/snapshots/${date}.json`);
                if (response.ok) {
                    const data = await response.json();

                    // Wrap all players and brawlers in historical snapshots for compatibility
                    data.clubs = (data.clubs || []).map(club => ({
                        ...club,
                        members: (club.members || []).map(player => {
                            const wrapped = wrapCompat(player);
                            wrapped.brawlers = (player.brawlers || []).map(b => wrapCompat(b));
                            return wrapped;
                        })
                    }));

                    data.individual_players = (data.individual_players || []).map(player => {
                        const wrapped = wrapCompat(player);
                        wrapped.brawlers = (player.brawlers || []).map(b => wrapCompat(b));
                        return wrapped;
                    });

                    this.historicalData.push(data);
                }
            } catch (error) {
                // File doesn't exist
            }
        }

        this.historicalData.sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    async loadBrawlersReference() {
        const response = await fetch('data/brawlers.json');
        this.brawlersData = await response.json();
        return this.brawlersData;
    },

    async loadAchievements() {
        try {
            const response = await fetch('data/achievements.json');
            if (response.ok) {
                this.achievementsData = await response.json();
            }
        } catch (error) {
            console.warn('Could not load achievements:', error);
            this.achievementsData = [];
        }
        return this.achievementsData;
    },

    getAllPlayers() {
        const players = [];
        this.latestData.clubs.forEach((club, clubIndex) => {
            club.members.forEach((player, playerIndex) => {
                // Wrap player and brawlers for compatibility
                const wrappedPlayer = wrapCompat({ ...player, clubIndex, playerIndex });
                wrappedPlayer.brawlers = (player.brawlers || []).map(b => wrapCompat(b));
                players.push(wrappedPlayer);
            });
        });
        (this.latestData.individual_players || []).forEach((player, playerIndex) => {
            const wrappedPlayer = wrapCompat({ ...player, clubIndex: -1, playerIndex });
            wrappedPlayer.brawlers = (player.brawlers || []).map(b => wrapCompat(b));
            players.push(wrappedPlayer);
        });
        return players;
    },

    getPlayer(clubIndex, playerIndex) {
        let player;
        if (clubIndex === -1) {
            player = this.latestData.individual_players[playerIndex];
        } else {
            player = this.latestData.clubs[clubIndex].members[playerIndex];
        }

        // Wrap for compatibility
        const wrapped = wrapCompat(player);
        wrapped.brawlers = (player.brawlers || []).map(b => wrapCompat(b));
        return wrapped;
    },

    findPlayerInSnapshot(snapshot, tag) {
        for (const club of snapshot.clubs) {
            const p = club.members.find(m => m.tag === tag);
            if (p) {
                const wrapped = wrapCompat(p);
                wrapped.brawlers = (p.brawlers || []).map(b => wrapCompat(b));
                return wrapped;
            }
        }
        const individual = (snapshot.individual_players || []).find(p => p.tag === tag);
        if (individual) {
            const wrapped = wrapCompat(individual);
            wrapped.brawlers = (individual.brawlers || []).map(b => wrapCompat(b));
            return wrapped;
        }
        return null;
    },

    getBrawlerName(brawlerId) {
        const brawler = this.brawlersData.items.find(b => b.id === brawlerId);
        return brawler ? brawler.name : 'Unknown';
    },

    getBrawlerById(brawlerId) {
        return this.brawlersData.items.find(b => b.id === brawlerId);
    },

    getAllBrawlerNames() {
        return this.brawlersData.items.map(b => b.name).sort();
    },

    // Battlelog loading methods
    async loadBattlelogs() {
        const players = this.getAllPlayers();

        for (const player of players) {
            await this.loadBattlelogForPlayer(player.tag);
        }

        await this.loadBattlelogMetadata();
    },

    async loadBattlelogForPlayer(tag) {
        const filename = tag.replace('#', '');
        try {
            const response = await fetch(`data/battlelogs/${filename}.json`);
            if (response.ok) {
                const battles = await response.json();
                this.battlelogsCache.set(tag, battles);
                return battles;
            } else {
                console.warn(`Failed to load battlelog for ${tag}: ${response.status}`);
            }
        } catch (error) {
            console.warn(`Error loading battlelog for ${tag}:`, error);
        }
        return [];
    },

    async loadBattlelogMetadata() {
        try {
            const response = await fetch('data/battlelogs/_last_updated.json');
            if (response.ok) {
                this.battlelogsMetadata = await response.json();
            }
        } catch (error) {
            console.warn('No battlelog metadata found');
        }
    },

    getBattlesForPlayer(tag) {
        return this.battlelogsCache.get(tag) || [];
    },

    getAllBattles() {
        const allBattles = [];
        for (const [tag, battles] of this.battlelogsCache.entries()) {
            battles.forEach(battle => {
                allBattles.push({
                    playerTag: tag,
                    ...battle
                });
            });
        }
        return allBattles;
    },

    getTotalBattleCount() {
        let total = 0;
        for (const battles of this.battlelogsCache.values()) {
            total += battles.length;
        }
        return total;
    },

    getPlayerBattleCount(tag) {
        return this.getBattlesForPlayer(tag).length;
    },

    getBattlelogLastCollectionTime() {
        return this.battlelogsMetadata?.last_collection || null;
    }
};
