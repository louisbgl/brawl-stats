// Charts module - handles all Chart.js visualizations

const ChartsManager = {
    charts: {},
    colors: [
        '#4a9eff', '#9d4edd', '#06d6a0', '#ff9f1c',
        '#ef476f', '#118ab2', '#ffd60a'
    ],

    createTrophyTimeline() {
        if (DataManager.historicalData.length === 0) return;

        const players = DataManager.getAllPlayers();
        const dates = DataManager.historicalData.map(s => s.date);

        const datasets = players.map((player, idx) => {
            const trophyData = DataManager.historicalData.map(snapshot => {
                const p = DataManager.findPlayerInSnapshot(snapshot, player.tag);
                return p ? p.trophies : null;
            });

            return {
                label: player.name,
                data: trophyData,
                borderColor: this.colors[idx % this.colors.length],
                backgroundColor: this.colors[idx % this.colors.length] + '20',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6
            };
        });

        const ctx = document.getElementById('trophyChart')?.getContext('2d');
        if (ctx) {
            this.charts.trophy = new Chart(ctx, {
                type: 'line',
                data: { labels: dates, datasets },
                options: this.getCommonLineOptions('Trophies')
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

                    return {
                        label: player.name,
                        data: trophyData,
                        borderColor: this.colors[idx % this.colors.length],
                        backgroundColor: this.colors[idx % this.colors.length] + '20',
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    };
                });

                const ctx = canvas.getContext('2d');
                this.charts.trophyTimeline = new Chart(ctx, {
                    type: 'line',
                    data: { labels: dates, datasets },
                    options: this.getCommonLineOptions('Trophies')
                });
                return;
            }

            const datasets = players.map((player, idx) => {
                const trophyData = DataManager.historicalData.map(snapshot => {
                    const p = DataManager.findPlayerInSnapshot(snapshot, player.tag);
                    if (!p) return null;
                    const brawler = p.brawlers.find(b => b.name === brawlerName);
                    return brawler ? brawler.trophies : null;
                });

                // Only include if player has this brawler
                if (trophyData.some(t => t !== null)) {
                    return {
                        label: player.name,
                        data: trophyData,
                        borderColor: this.colors[idx % this.colors.length],
                        backgroundColor: this.colors[idx % this.colors.length] + '20',
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        spanGaps: true
                    };
                }
                return null;
            }).filter(d => d !== null);

            const ctx = canvas.getContext('2d');
            this.charts.trophyTimeline = new Chart(ctx, {
                type: 'line',
                data: { labels: dates, datasets },
                options: this.getCommonLineOptions(`${brawlerName} Trophies`)
            });
            return;
        }

        // All battles view
        if (!BattlelogDataManager.isLoaded) return;

        const playerBattleData = {};

        players.forEach(player => {
            const battles = BattlelogDataManager.getBattlesForPlayer(player.tag);
            playerBattleData[player.tag] = [];

            // Get current trophy count for this player (or brawler if filtered)
            let currentTrophies;
            if (brawlerName) {
                const brawler = player.brawlers.find(b => b.name === brawlerName);
                currentTrophies = brawler ? brawler.trophies : 0;
                if (!currentTrophies) return; // Player doesn't have this brawler
            } else {
                currentTrophies = player.trophies;
            }

            // Create a copy and sort oldest to newest by parsing dates
            const sortedBattles = [...battles].sort((a, b) => {
                const dateA = Utils.parseBattleTime(a.battleTime);
                const dateB = Utils.parseBattleTime(b.battleTime);
                return dateA - dateB;
            });

            // Filter by brawler if specified - need to extract player's brawler from battle
            const relevantBattles = [];
            sortedBattles.forEach(battle => {
                // Find which brawler this player used in this battle
                let playerBrawler = null;

                // Check team modes
                if (battle.battle.teams) {
                    for (const team of battle.battle.teams) {
                        const playerInTeam = team.find(p => p.tag === player.tag);
                        if (playerInTeam) {
                            playerBrawler = playerInTeam.brawler.name;
                            break;
                        }
                    }
                }

                // Check solo modes (showdown)
                if (!playerBrawler && battle.battle.players) {
                    const playerInBattle = battle.battle.players.find(p => p.tag === player.tag);
                    if (playerInBattle && playerInBattle.brawler) {
                        playerBrawler = playerInBattle.brawler.name;
                    }
                }

                // Include if no filter or brawler matches
                if (!brawlerName || playerBrawler === brawlerName) {
                    relevantBattles.push(battle);
                }
            });

            if (relevantBattles.length === 0) return;

            // Calculate starting trophy count by working backwards from current
            const totalChange = relevantBattles.reduce((sum, b) => sum + (b.battle.trophyChange || 0), 0);
            let runningTrophies = currentTrophies - totalChange;

            // Now go forward through battles, adding trophy changes
            relevantBattles.forEach(battle => {
                const battleDate = Utils.parseBattleTime(battle.battleTime);
                if (!battleDate) return;
                const trophyChange = battle.battle.trophyChange || 0;

                runningTrophies += trophyChange;

                playerBattleData[player.tag].push({
                    timestamp: battleDate.getTime(),
                    dateLabel: this.formatBattleTimestamp(battleDate),
                    trophies: runningTrophies,
                    mode: battle.battle.mode,
                    result: trophyChange > 0 ? 'Win' : trophyChange < 0 ? 'Loss' : 'Draw',
                    trophyChange: trophyChange
                });
            });
        });

        // Create datasets with point data
        const datasets = players.map((player, idx) => {
            const battles = playerBattleData[player.tag];
            if (!battles || battles.length === 0) return null;

            return {
                label: player.name,
                data: battles.map(b => ({ x: b.timestamp, y: b.trophies })),
                borderColor: this.colors[idx % this.colors.length],
                backgroundColor: this.colors[idx % this.colors.length] + '20',
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
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        type: 'linear',
                        ticks: {
                            callback: (value) => {
                                return this.formatBattleTimestamp(new Date(value));
                            },
                            color: '#9ba3af',
                            maxRotation: 45,
                            minRotation: 45,
                            maxTicksLimit: 12
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: value => value.toLocaleString(),
                            color: '#9ba3af'
                        },
                        grid: {
                            color: '#3a4556'
                        },
                        title: {
                            display: true,
                            text: brawlerName ? `${brawlerName} Trophies` : 'Trophies',
                            color: '#e8eaed'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#e8eaed',
                            usePointStyle: true,
                            padding: 15
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        padding: 12,
                        titleColor: '#e8eaed',
                        bodyColor: '#e8eaed',
                        itemSort: (a, b) => b.parsed.y - a.parsed.y,
                        callbacks: {
                            title: (context) => {
                                return this.formatBattleTimestamp(new Date(context[0].parsed.x));
                            },
                            label: (context) => {
                                const playerTag = players[context.datasetIndex].tag;
                                const battles = playerBattleData[playerTag];
                                const battle = battles.find(b => b.timestamp === context.parsed.x);

                                if (battle && battle.trophyChange !== undefined) {
                                    const changeStr = battle.trophyChange > 0
                                        ? `+${battle.trophyChange}`
                                        : `${battle.trophyChange}`;
                                    return `${context.dataset.label}: ${context.parsed.y.toLocaleString()} (${changeStr})`;
                                }
                                return `${context.dataset.label}: ${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                }
            }
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

                return {
                    label: player.name,
                    data,
                    borderColor: this.colors[idx % this.colors.length],
                    backgroundColor: this.colors[idx % this.colors.length] + '20',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6
                };
            });
        } else if (gamemode === '3v3') {
            datasets = this.createWinsDatasets(players, 'victories_3v3', '');
            title = '3v3 Wins';
        } else if (gamemode === 'solo') {
            datasets = this.createWinsDatasets(players, 'solo_victories', '');
            title = 'Solo Wins';
        } else if (gamemode === 'duo') {
            datasets = this.createWinsDatasets(players, 'duo_victories', '');
            title = 'Duo Wins';
        }

        const ctx = document.getElementById('winsChart').getContext('2d');
        this.charts.wins = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: datasets
            },
            options: this.getCommonLineOptions(title)
        });
    },

    createWinsDatasets(players, field, suffix) {
        return players.map((player, idx) => {
            const data = DataManager.historicalData.map(snapshot => {
                const p = DataManager.findPlayerInSnapshot(snapshot, player.tag);
                return p ? p[field] || 0 : null;
            });

            return {
                label: player.name + suffix,
                data,
                borderColor: this.colors[idx % this.colors.length],
                backgroundColor: this.colors[idx % this.colors.length] + '20',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 5
            };
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

            return {
                label: player.name,
                data,
                borderColor: this.colors[idx % this.colors.length],
                backgroundColor: this.colors[idx % this.colors.length] + '20',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6
            };
        });

        const ctx = document.getElementById('collectionChart').getContext('2d');
        this.charts.collection = new Chart(ctx, {
            type: 'line',
            data: { labels: dates, datasets },
            options: this.getCommonLineOptions('Brawlers Owned')
        });
    },

    createMaxedTimeline() {
        const players = DataManager.getAllPlayers();
        const dates = DataManager.historicalData.map(s => s.date);

        const datasets = players.map((player, idx) => {
            const data = DataManager.historicalData.map(snapshot => {
                const p = DataManager.findPlayerInSnapshot(snapshot, player.tag);
                if (!p) return null;
                return p.brawlers.filter(b =>
                    b.power === 11 &&
                    b.gadget_ids.length >= 2 &&
                    b.star_power_ids.length >= 2 &&
                    b.hyper_charge_ids.length >= 1
                ).length;
            });

            return {
                label: player.name,
                data,
                borderColor: this.colors[idx % this.colors.length],
                backgroundColor: this.colors[idx % this.colors.length] + '20',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6
            };
        });

        const ctx = document.getElementById('maxedChart').getContext('2d');
        this.charts.maxed = new Chart(ctx, {
            type: 'line',
            data: { labels: dates, datasets },
            options: this.getCommonLineOptions('Maxed Brawlers')
        });
    },

    createPrestigeTimeline() {
        const players = DataManager.getAllPlayers();
        const dates = DataManager.historicalData.map(s => s.date);

        const datasets = players.map((player, idx) => {
            const data = DataManager.historicalData.map(snapshot => {
                const p = DataManager.findPlayerInSnapshot(snapshot, player.tag);
                if (!p) return null;
                return p.brawlers.filter(b => b.trophies >= 1000).length;
            });

            return {
                label: player.name,
                data,
                borderColor: this.colors[idx % this.colors.length],
                backgroundColor: this.colors[idx % this.colors.length] + '20',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6
            };
        });

        const ctx = document.getElementById('prestigeChart').getContext('2d');
        this.charts.prestige = new Chart(ctx, {
            type: 'line',
            data: { labels: dates, datasets },
            options: this.getCommonLineOptions('Prestige Brawlers (1000+ Trophies)')
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
                backgroundColor: this.colors[idx % this.colors.length] + '80',
                borderColor: this.colors[idx % this.colors.length],
                borderWidth: 1
            };
        });

        const ctx = canvas.getContext('2d');
        this.charts.activityTimeline = new Chart(ctx, {
            type: 'bar',
            data: { labels: dates, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        stacked: false,
                        ticks: {
                            callback: value => value.toLocaleString(),
                            color: '#9ba3af'
                        },
                        grid: {
                            color: '#3a4556'
                        },
                        title: {
                            display: true,
                            text: 'Games Played',
                            color: '#e8eaed'
                        }
                    },
                    x: {
                        stacked: false,
                        ticks: {
                            color: '#9ba3af',
                            maxRotation: 45,
                            minRotation: 45
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#e8eaed',
                            usePointStyle: true,
                            padding: 15
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        padding: 12,
                        titleColor: '#e8eaed',
                        bodyColor: '#e8eaed',
                        itemSort: (a, b) => b.parsed.y - a.parsed.y,
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${context.parsed.y} game${context.parsed.y !== 1 ? 's' : ''}`;
                            }
                        }
                    }
                }
            }
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

                // Use UTC date to avoid timezone boundary issues
                const year = battleDate.getUTCFullYear();
                const month = String(battleDate.getUTCMonth() + 1).padStart(2, '0');
                const day = String(battleDate.getUTCDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;

                allDates.add(dateStr);

                if (!playerModeData[player.tag][dateStr]) {
                    playerModeData[player.tag][dateStr] = {};
                }

                const mode = battle.battle.mode || 'Unknown';
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

        // Define colors for common modes
        const modeColors = {
            'gemGrab': '#06d6a0',
            'brawlBall': '#4a9eff',
            'bounty': '#ff9f1c',
            'heist': '#ef476f',
            'hotZone': '#9d4edd',
            'knockout': '#118ab2',
            'showdown': '#ffd60a',
            'duoShowdown': '#ffb703',
            'soloShowdown': '#ffd60a',
            'wipeout': '#e63946'
        };

        const datasets = Array.from(allModes).map((mode, idx) => ({
            label: mode,
            data: modePercentages[mode],
            backgroundColor: modeColors[mode] || this.colors[idx % this.colors.length] + 'cc',
            borderColor: modeColors[mode] || this.colors[idx % this.colors.length],
            borderWidth: 1,
            fill: true
        }));

        const ctx = canvas.getContext('2d');
        this.charts.modePopularity = new Chart(ctx, {
            type: 'line',
            data: { labels: dates, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: value => value + '%',
                            color: '#9ba3af'
                        },
                        grid: {
                            color: '#3a4556'
                        },
                        title: {
                            display: true,
                            text: 'Mode Distribution (%)',
                            color: '#e8eaed'
                        }
                    },
                    x: {
                        stacked: true,
                        ticks: {
                            color: '#9ba3af',
                            maxRotation: 45,
                            minRotation: 45
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#e8eaed',
                            usePointStyle: true,
                            padding: 15
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        padding: 12,
                        titleColor: '#e8eaed',
                        bodyColor: '#e8eaed',
                        itemSort: (a, b) => b.parsed.y - a.parsed.y,
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
                            }
                        }
                    }
                }
            }
        });
    },

    formatBattleTimestamp(date) {
        if (!date || isNaN(date.getTime())) return '';

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        // Format time as HH:MM
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;

        // If today, show "Today HH:MM"
        if (dateDay.getTime() === today.getTime()) {
            return `Today ${timeStr}`;
        }

        // If yesterday, show "Yesterday HH:MM"
        if (dateDay.getTime() === yesterday.getTime()) {
            return `Yesterday ${timeStr}`;
        }

        // Otherwise show "MMM DD HH:MM"
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const day = date.getDate();
        return `${month} ${day} ${timeStr}`;
    },

    getCommonLineOptions(yLabel) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: value => value.toLocaleString(),
                        color: '#9ba3af'
                    },
                    grid: {
                        color: '#3a4556'
                    },
                    title: {
                        display: true,
                        text: yLabel,
                        color: '#e8eaed'
                    }
                },
                x: {
                    ticks: {
                        color: '#9ba3af',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#e8eaed',
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    itemSort: (a, b) => b.parsed.y - a.parsed.y,
                    callbacks: {
                        label: context =>
                            `${context.dataset.label}: ${context.parsed.y.toLocaleString()}`
                    }
                }
            }
        };
    }
};
