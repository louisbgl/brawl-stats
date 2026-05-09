// Battlelog Data module - thin wrapper around DataManager for backwards compatibility
// All battlelog data now managed by DataManager

const BattlelogDataManager = {
    // Backwards compatibility: expose isLoaded flag
    get isLoaded() {
        return DataManager.battlelogsCache.size > 0;
    },

    // Ensure battlelog data is loaded before using
    async ensureLoaded() {
        await DataManager.ensureBattlelogsLoaded();
        return this.isLoaded;
    },

    // Delegate all methods to DataManager
    getBattlesForPlayer(tag) {
        return DataManager.getBattlesForPlayer(tag);
    },

    getAllBattles() {
        return DataManager.getAllBattles();
    },

    getTotalBattleCount() {
        return DataManager.getTotalBattleCount();
    },

    getPlayerBattleCount(tag) {
        return DataManager.getPlayerBattleCount(tag);
    },

    getLastCollectionTime() {
        return DataManager.getBattlelogLastCollectionTime();
    }
};
