// Battlelog Data module - handles loading and caching of battle log data

const BattlelogDataManager = {
    battlelogsCache: new Map(), // tag -> battle items array
    metadataCache: null,
    isLoaded: false,
    loadingPromise: null,

    // Start loading in background but return immediately
    init() {
        if (!this.loadingPromise) {
            this.loadingPromise = this._loadAll();
        }
        return this.loadingPromise;
    },

    // Internal method that does the actual loading
    async _loadAll() {
        await this.loadAllBattlelogs();
        await this.loadMetadata();
        this.isLoaded = true;
    },

    // Ensure battlelog data is loaded before using
    async ensureLoaded() {
        if (this.loadingPromise) {
            await this.loadingPromise;
        }
        return this.isLoaded;
    },

    async loadAllBattlelogs() {
        const players = DataManager.getAllPlayers();

        for (const player of players) {
            await this.loadBattlelogForPlayer(player.tag);
        }
    },

    async loadBattlelogForPlayer(tag) {
        const filename = tag.replace('#', '');
        try {
            const response = await fetch(`data/battlelogs/${filename}.json`);
            if (response.ok) {
                const battles = await response.json();
                this.battlelogsCache.set(tag, battles);
                return battles;
            }
        } catch (error) {
            console.warn(`No battlelog found for ${tag}`);
        }
        return [];
    },

    async loadMetadata() {
        try {
            const response = await fetch('data/battlelogs/_last_updated.json');
            if (response.ok) {
                this.metadataCache = await response.json();
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

    getLastCollectionTime() {
        return this.metadataCache?.last_collection || null;
    }
};
