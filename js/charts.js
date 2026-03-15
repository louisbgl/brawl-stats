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
                let trophies = null;
                snapshot.clubs.forEach(club => {
                    const p = club.members.find(m => m.tag === player.tag);
                    if (p) trophies = p.trophies;
                });
                return trophies;
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

        const ctx = document.getElementById('trophyChart').getContext('2d');
        this.charts.trophy = new Chart(ctx, {
            type: 'line',
            data: { labels: dates, datasets },
            options: this.getCommonLineOptions('Trophies')
        });
    },

    createBrawlerTrophyTimeline(brawlerName) {
        const canvas = document.getElementById('brawlerTrophyChart');
        if (!canvas) return;

        if (this.charts.brawlerTrophy) {
            this.charts.brawlerTrophy.destroy();
        }

        if (!brawlerName) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const players = DataManager.getAllPlayers();
        const dates = DataManager.historicalData.map(s => s.date);

        const datasets = players.map((player, idx) => {
            const trophyData = DataManager.historicalData.map(snapshot => {
                let trophies = null;
                snapshot.clubs.forEach(club => {
                    const p = club.members.find(m => m.tag === player.tag);
                    if (p) {
                        const brawler = p.brawlers.find(b => b.name === brawlerName);
                        if (brawler) trophies = brawler.trophies;
                    }
                });
                return trophies;
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
        this.charts.brawlerTrophy = new Chart(ctx, {
            type: 'line',
            data: { labels: dates, datasets },
            options: this.getCommonLineOptions(`${brawlerName} Trophies`)
        });
    },

    createWinsTimeline() {
        const players = DataManager.getAllPlayers();
        const dates = DataManager.historicalData.map(s => s.date);

        // Create 3 datasets per player (3v3, solo, duo)
        const datasets3v3 = this.createWinsDatasets(players, dates, '3vs3Victories', ' (3v3)');
        const datasetsSolo = this.createWinsDatasets(players, dates, 'soloVictories', ' (Solo)');
        const datasetsDuo = this.createWinsDatasets(players, dates, 'duoVictories', ' (Duo)');

        const ctx = document.getElementById('winsChart').getContext('2d');
        this.charts.wins = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [...datasets3v3, ...datasetsSolo, ...datasetsDuo]
            },
            options: this.getCommonLineOptions('Total Wins')
        });
    },

    createWinsDatasets(players, dates, field, suffix) {
        return players.map((player, idx) => {
            const data = DataManager.historicalData.map(snapshot => {
                let value = null;
                snapshot.clubs.forEach(club => {
                    const p = club.members.find(m => m.tag === player.tag);
                    if (p) value = p[field] || 0;
                });
                return value;
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
                let count = null;
                snapshot.clubs.forEach(club => {
                    const p = club.members.find(m => m.tag === player.tag);
                    if (p) count = p.brawlers.length;
                });
                return count;
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
                let count = null;
                snapshot.clubs.forEach(club => {
                    const p = club.members.find(m => m.tag === player.tag);
                    if (p) {
                        count = p.brawlers.filter(b =>
                            b.power === 11 &&
                            b.gadget_ids.length >= 2 &&
                            b.star_power_ids.length >= 2 &&
                            b.hyper_charge_ids.length >= 1
                        ).length;
                    }
                });
                return count;
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
                let count = null;
                snapshot.clubs.forEach(club => {
                    const p = club.members.find(m => m.tag === player.tag);
                    if (p) {
                        count = p.brawlers.filter(b => b.trophies >= 1000).length;
                    }
                });
                return count;
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
