// Charts module - handles all Chart.js visualizations
// Refactored to use shared helpers from helpers.js and constants from config.js

const ChartsManager = {
    charts: {},

    createTrophyTimeline() {
        if (DataManager.historicalData.length === 0) return;

        const players = DataManager.getAllPlayers();
        const dates = DataManager.historicalData.map(s => s.date);

        const datasets = players.map((player, idx) => {
            const trophyData = DataManager.historicalData.map(snapshot => {
                const p = DataManager.findPlayerInSnapshot(snapshot, player.tag);
                return p ? p.trophies : null;
            });

            return ChartHelpers.createLineDataset(
                player.name,
                trophyData,
                GameConstants.COLOR_PALETTE[idx % GameConstants.COLOR_PALETTE.length]
            );
        });

        const ctx = document.getElementById('trophyChart')?.getContext('2d');
        if (ctx) {
            this.charts.trophy = new Chart(ctx, {
                type: 'line',
                data: { labels: dates, datasets },
                options: ChartHelpers.getCommonLineOptions('Trophies')
            });
        }
    },

    createBrawlerTrophyTimeline(brawlerName, viewMode = 'daily') {
        const canvas = document.getElementById('trophyTimelineChart');
        if (!canvas) return;

        if (this.charts.trophyTimeline) {
            this.charts.trophyTimeline.destroy();
        }

        const players = DataManager.getAllPlayers();

        // Daily snapshots view (default)
        if (viewMode === 'daily') {
            const dates = DataManager.historicalData.map(s => s.date);

            if (!brawlerName) {
                // Show overall player trophies
                const datasets = players.map((player, idx) => {
                    const trophyData = DataManager.historicalData.map(snapshot => {
                        const p = DataManager.findPlayerInSnapshot(snapshot, player.tag);
                        return p ? p.trophies : null;
                    });

                    return ChartHelpers.createLineDataset(
                        player.name,
                        trophyData,
                        GameConstants.COLOR_PALETTE[idx % GameConstants.COLOR_PALETTE.length]
                    );
                });

                const ctx = canvas.getContext('2d');
                this.charts.trophyTimeline = new Chart(ctx, {
                    type: 'line',
                    data: { labels: dates, datasets },
                    options: ChartHelpers.getCommonLineOptions('Trophies')
                });
                return;
            }

            // Show brawler-specific trophies
            const datasets = players.map((player, idx) => {
                const trophyData = DataManager.historicalData.map(snapshot => {
                    const p = DataManager.findPlayerInSnapshot(snapshot, player.tag);
                    if (!p) return null;
                    const brawler = p.brawlers.find(b => b.name === brawlerName);
                    return brawler ? brawler.trophies : null;
                });

                // Only include if player has this brawler
                if (trophyData.some(t => t !== null)) {
                    return ChartHelpers.createLineDataset(
                        player.name,
                        trophyData,
                        GameConstants.COLOR_PALETTE[idx % GameConstants.COLOR_PALETTE.length],
                        { spanGaps: true }
                    );
                }
                return null;
            }).filter(d => d !== null);

            const ctx = canvas.getContext('2d');
            this.charts.trophyTimeline = new Chart(ctx, {
                type: 'line',
                data: { labels: dates, datasets },
                options: ChartHelpers.getCommonLineOptions(`${brawlerName} Trophies`)
            });
            return;
        }

        // All battles view - use helper to construct timeline
        if (!BattlelogDataManager.isLoaded) return;

        const playerBattleData = {};

        players.forEach(player => {
            const battles = BattlelogDataManager.getBattlesForPlayer(player.tag);
            const timeline = BattlelogHelpers.constructTrophyTimeline(
                player.tag,
                DataManager.historicalData,
                battles,
                brawlerName
            );

            if (timeline.dates.length > 0) {
                playerBattleData[player.tag] = timeline.dates.map((dateStr, i) => ({
                    timestamp: new Date(dateStr).getTime(),
                    trophies: timeline.trophies[i],
                    source: timeline.sources[i]
                }));
            }
        });

        // Create datasets with point data
        const datasets = players.map((player, idx) => {
            const battles = playerBattleData[player.tag];
            if (!battles || battles.length === 0) return null;

            return {
                label: player.name,
                data: battles.map(b => ({ x: b.timestamp, y: b.trophies })),
                borderColor: GameConstants.COLOR_PALETTE[idx % GameConstants.COLOR_PALETTE.length],
                backgroundColor: GameConstants.COLOR_PALETTE[idx % GameConstants.COLOR_PALETTE.length] + '20',
                borderWidth: 1,
                tension: 0.1,
                pointRadius: 2,
                pointHoverRadius: 4
            };
        }).filter(d => d !== null);

        const ctx = canvas.getContext('2d');
        this.charts.trophyTimeline = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: ChartHelpers.getCommonLineOptions(
                brawlerName ? `${brawlerName} Trophies` : 'Trophies',
                {
                    scales: {
                        x: {
                            type: 'linear',
                            ticks: {
                                callback: (value) => ChartHelpers.formatBattleTimestamp(new Date(value)),
                                color: '#9ba3af',
                                maxRotation: 45,
                                minRotation: 45,
                                maxTicksLimit: 12
                            },
                            grid: { display: false }
                        }
                    }
                }
            )
        });
    },

    createWinsTimeline(gamemode = '') {
        if (this.charts.wins) {
            this.charts.wins.destroy();
        }

        const players = DataManager.getAllPlayers();
        const dates = DataManager.historicalData.map(s => s.date);

        let datasets;
        let title = 'Total Wins';

        if (!gamemode) {
            // Overall - show total wins per player
            datasets = players.map((player, idx) => {
                const data = DataManager.historicalData.map(snapshot => {
                    const p = DataManager.findPlayerInSnapshot(snapshot, player.tag);
                    if (!p) return null;
                    return (p.victories_3v3 || 0) + (p.solo_victories || 0) + (p.duo_victories || 0);
                });

                return ChartHelpers.createLineDataset(
                    player.name,
                    data,
                    GameConstants.COLOR_PALETTE[idx % GameConstants.COLOR_PALETTE.length]
                );
            });
        } else if (gamemode === '3v3') {
            datasets = this.createWinsDatasets(players, 'victories_3v3');
            title = '3v3 Wins';
        } else if (gamemode === 'solo') {
            datasets = this.createWinsDatasets(players, 'solo_victories');
            title = 'Solo Wins';
        } else if (gamemode === 'duo') {
            datasets = this.createWinsDatasets(players, 'duo_victories');
            title = 'Duo Wins';
        }

        const ctx = document.getElementById('winsChart').getContext('2d');
        this.charts.wins = new Chart(ctx, {
            type: 'line',
            data: { labels: dates, datasets },
            options: ChartHelpers.getCommonLineOptions(title)
        });
    },

    createWinsDatasets(players, field) {
        return players.map((player, idx) => {
            const data = DataManager.historicalData.map(snapshot => {
                const p = DataManager.findPlayerInSnapshot(snapshot, player.tag);
                return p ? p[field] || 0 : null;
            });

            return ChartHelpers.createLineDataset(
                player.name,
                data,
                GameConstants.COLOR_PALETTE[idx % GameConstants.COLOR_PALETTE.length],
                { pointRadius: 3, pointHoverRadius: 5 }
            );
        });
    },

    createCollectionTimeline() {
        const players = DataManager.getAllPlayers();
        const dates = DataManager.historicalData.map(s => s.date);

        const datasets = players.map((player, idx) => {
            const data = DataManager.historicalData.map(snapshot => {
                const p = DataManager.findPlayerInSnapshot(snapshot, player.tag);
                return p ? p.brawlers.length : null;
            });

            return ChartHelpers.createLineDataset(
                player.name,
                data,
                GameConstants.COLOR_PALETTE[idx % GameConstants.COLOR_PALETTE.length]
            );
        });

        const ctx = document.getElementById('collectionChart').getContext('2d');
        this.charts.collection = new Chart(ctx, {
            type: 'line',
            data: { labels: dates, datasets },
            options: ChartHelpers.getCommonLineOptions('Brawlers Owned')
        });
    },

    createMaxedTimeline() {
        const players = DataManager.getAllPlayers();
        const dates = DataManager.historicalData.map(s => s.date);

        const datasets = players.map((player, idx) => {
            const data = DataManager.historicalData.map(snapshot => {
                const p = DataManager.findPlayerInSnapshot(snapshot, player.tag);
                if (!p) return null;
                return p.brawlers.filter(b => CalculationHelpers.isMaxedBrawler(b)).length;
            });

            return ChartHelpers.createLineDataset(
                player.name,
                data,
                GameConstants.COLOR_PALETTE[idx % GameConstants.COLOR_PALETTE.length]
            );
        });

        const ctx = document.getElementById('maxedChart').getContext('2d');
        this.charts.maxed = new Chart(ctx, {
            type: 'line',
            data: { labels: dates, datasets },
            options: ChartHelpers.getCommonLineOptions('Maxed Brawlers')
        });
    },

    createPrestigeTimeline() {
        const players = DataManager.getAllPlayers();
        const dates = DataManager.historicalData.map(s => s.date);

        const datasets = players.map((player, idx) => {
            const data = DataManager.historicalData.map(snapshot => {
                const p = DataManager.findPlayerInSnapshot(snapshot, player.tag);
                if (!p) return null;
                return p.brawlers.filter(b => b.trophies >= GameConstants.PRESTIGE_THRESHOLD).length;
            });

            return ChartHelpers.createLineDataset(
                player.name,
                data,
                GameConstants.COLOR_PALETTE[idx % GameConstants.COLOR_PALETTE.length]
            );
        });

        const ctx = document.getElementById('prestigeChart').getContext('2d');
        this.charts.prestige = new Chart(ctx, {
            type: 'line',
            data: { labels: dates, datasets },
            options: ChartHelpers.getCommonLineOptions('Prestige Brawlers (1000+ Trophies)')
        });
    },

    createActivityTimeline(daysFilter = 'all') {
        const canvas = document.getElementById('activityTimelineChart');
        if (!canvas || !BattlelogDataManager.isLoaded) return;

        if (this.charts.activityTimeline) {
            this.charts.activityTimeline.destroy();
        }

        const players = DataManager.getAllPlayers();

        // Get date range
        const now = new Date();
        const cutoffDate = daysFilter === 'all' ? null :
                          daysFilter === '30' ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) :
                          new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Collect all battles per player per day
        const playerDailyGames = {};
        const allDates = new Set();

        players.forEach(player => {
            const battles = BattlelogDataManager.getBattlesForPlayer(player.tag);
            playerDailyGames[player.tag] = {};

            battles.forEach(battle => {
                const battleDate = Utils.parseBattleTime(battle.battleTime);
                if (!battleDate) return;

                // Use UTC date to avoid timezone boundary issues
                const year = battleDate.getUTCFullYear();
                const month = String(battleDate.getUTCMonth() + 1).padStart(2, '0');
                const day = String(battleDate.getUTCDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;

                if (cutoffDate && battleDate < cutoffDate) return;

                allDates.add(dateStr);
                playerDailyGames[player.tag][dateStr] = (playerDailyGames[player.tag][dateStr] || 0) + 1;
            });
        });

        const dates = Array.from(allDates).sort();

        const datasets = players.map((player, idx) => {
            const data = dates.map(date => playerDailyGames[player.tag][date] || 0);

            return {
                label: player.name,
                data: data,
                backgroundColor: GameConstants.COLOR_PALETTE[idx % GameConstants.COLOR_PALETTE.length] + '80',
                borderColor: GameConstants.COLOR_PALETTE[idx % GameConstants.COLOR_PALETTE.length],
                borderWidth: 1
            };
        });

        const ctx = canvas.getContext('2d');
        this.charts.activityTimeline = new Chart(ctx, {
            type: 'bar',
            data: { labels: dates, datasets },
            options: ChartHelpers.getCommonLineOptions('Games Played', {
                scales: {
                    y: {
                        beginAtZero: true,
                        stacked: false
                    },
                    x: {
                        stacked: false
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${context.parsed.y} game${context.parsed.y !== 1 ? 's' : ''}`;
                            }
                        }
                    }
                }
            })
        });
    },

    createModePopularityTimeline() {
        const canvas = document.getElementById('modePopularityChart');
        if (!canvas || !BattlelogDataManager.isLoaded) return;

        if (this.charts.modePopularity) {
            this.charts.modePopularity.destroy();
        }

        const players = DataManager.getAllPlayers();
        const allDates = new Set();
        const playerModeData = {};

        // Collect all battles by date and mode for each player
        players.forEach(player => {
            const battles = BattlelogDataManager.getBattlesForPlayer(player.tag);
            playerModeData[player.tag] = {};

            battles.forEach(battle => {
                const battleDate = Utils.parseBattleTime(battle.battleTime);
                if (!battleDate) return;

                const year = battleDate.getUTCFullYear();
                const month = String(battleDate.getUTCMonth() + 1).padStart(2, '0');
                const day = String(battleDate.getUTCDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;

                allDates.add(dateStr);

                if (!playerModeData[player.tag][dateStr]) {
                    playerModeData[player.tag][dateStr] = {};
                }

                const mode = BattlelogHelpers.getBattleMode(battle);
                playerModeData[player.tag][dateStr][mode] = (playerModeData[player.tag][dateStr][mode] || 0) + 1;
            });
        });

        const dates = Array.from(allDates).sort();

        // Aggregate mode counts across all players by date
        const modesByDate = {};
        dates.forEach(date => {
            modesByDate[date] = {};
            players.forEach(player => {
                const modes = playerModeData[player.tag][date] || {};
                Object.entries(modes).forEach(([mode, count]) => {
                    modesByDate[date][mode] = (modesByDate[date][mode] || 0) + count;
                });
            });
        });

        // Get all unique modes
        const allModes = new Set();
        Object.values(modesByDate).forEach(modes => {
            Object.keys(modes).forEach(mode => allModes.add(mode));
        });

        // Calculate percentages for each mode by date
        const modePercentages = {};
        Array.from(allModes).forEach(mode => {
            modePercentages[mode] = dates.map(date => {
                const totalGames = Object.values(modesByDate[date]).reduce((sum, count) => sum + count, 0);
                const modeGames = modesByDate[date][mode] || 0;
                return totalGames > 0 ? (modeGames / totalGames) * 100 : 0;
            });
        });

        const datasets = Array.from(allModes).map((mode, idx) => ({
            label: mode,
            data: modePercentages[mode],
            backgroundColor: GameConstants.MODE_COLORS[mode] || GameConstants.COLOR_PALETTE[idx % GameConstants.COLOR_PALETTE.length] + 'cc',
            borderColor: GameConstants.MODE_COLORS[mode] || GameConstants.COLOR_PALETTE[idx % GameConstants.COLOR_PALETTE.length],
            borderWidth: 1,
            fill: true
        }));

        const ctx = canvas.getContext('2d');
        this.charts.modePopularity = new Chart(ctx, {
            type: 'line',
            data: { labels: dates, datasets },
            options: ChartHelpers.getCommonLineOptions('Mode Distribution (%)', {
                scales: {
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: value => value + '%'
                        }
                    },
                    x: {
                        stacked: true
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
                            }
                        }
                    }
                }
            })
        });
    }
};
