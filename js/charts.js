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

    createBrawlerTrophyTimeline(brawlerName) {
        const canvas = document.getElementById('trophyTimelineChart');
        if (!canvas) return;

        if (this.charts.trophyTimeline) {
            this.charts.trophyTimeline.destroy();
        }

        const players = DataManager.getAllPlayers();
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
                    callbacks: {
                        label: context =>
                            `${context.dataset.label}: ${context.parsed.y.toLocaleString()}`
                    }
                }
            }
        };
    }
};
