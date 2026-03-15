// Data module - handles loading and caching of all data

const DataManager = {
    latestData: null,
    historicalData: [],
    brawlersData: null,

    async init() {
        await this.loadLatest();
        await this.loadHistorical();
        await this.loadBrawlersReference();
    },

    async loadLatest() {
        const response = await fetch('data/latest.json');
        this.latestData = await response.json();
        return this.latestData;
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
                const response = await fetch(`data/${date}.json`);
                if (response.ok) {
                    const data = await response.json();
                    this.historicalData.push(data);
                }
            } catch (error) {
                // File doesn't exist
            }
        }

        this.historicalData.sort((a, b) => new Date(a.date) - new Date(b.date));
        console.log(`Loaded ${this.historicalData.length} historical snapshots`);
    },

    async loadBrawlersReference() {
        const response = await fetch('data/brawlers.json');
        this.brawlersData = await response.json();
        return this.brawlersData;
    },

    getAllPlayers() {
        const players = [];
        this.latestData.clubs.forEach((club, clubIndex) => {
            club.members.forEach((player, playerIndex) => {
                players.push({
                    ...player,
                    clubIndex,
                    playerIndex
                });
            });
        });
        return players;
    },

    getPlayer(clubIndex, playerIndex) {
        return this.latestData.clubs[clubIndex].members[playerIndex];
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
    }
};
