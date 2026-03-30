// Player Charts module - handles Chart.js visualizations for individual players
// Refactored to use shared helpers from helpers.js and constants from config.js

const PlayerChartsManager = {
    prestigeChart: null,
    powerChart: null,
    trophyTimelineChart: null,
    modeChart: null,
    activityHeatmap: null,

    createPrestigeChart(prestigeStats) {
        if (this.prestigeChart) {
            this.prestigeChart.destroy();
        }

        const prestigeLevels = Object.keys(prestigeStats).map(Number).sort((a, b) => a - b);
        const labels = prestigeLevels.map(p => `Prestige ${p}`);
        const data = prestigeLevels.map(p => prestigeStats[p]);

        const backgroundColors = prestigeLevels.map(p => GameConstants.PRESTIGE_COLORS[p] || GameConstants.PRESTIGE_COLORS[0]);

        const ctx = document.getElementById('playerPrestigeChart').getContext('2d');
        this.prestigeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Brawlers',
                    data: data,
                    backgroundColor: backgroundColors
                }]
            },
            options: ChartHelpers.getCommonBarOptions('Number of Brawlers', {
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Prestige Level',
                            color: '#e8eaed'
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 25
                    }
                },
                animation: ChartHelpers.createBarWithLabelsAnimation()
            })
        });
    },

    createPowerChart(powerDistribution) {
        if (this.powerChart) {
            this.powerChart.destroy();
        }

        const labels = [];
        const data = [];
        for (let i = 1; i <= 11; i++) {
            labels.push(`P${i}`);
            data.push(powerDistribution[i]);
        }

        const ctx = document.getElementById('playerPowerChart').getContext('2d');
        this.powerChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Brawlers',
                    data: data,
                    backgroundColor: '#4a9eff'
                }]
            },
            options: ChartHelpers.getCommonBarOptions('Number of Brawlers', {
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Power Level',
                            color: '#e8eaed'
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 25
                    }
                },
                animation: ChartHelpers.createBarWithLabelsAnimation()
            })
        });
    },

    createPlayerTrophyChart(trophyTimeline) {
        if (this.trophyTimelineChart) {
            this.trophyTimelineChart.destroy();
        }

        if (trophyTimeline.dates.length === 0) {
            return;
        }

        const snapshotDates = trophyTimeline.snapshotDates;

        // Use linear axis with proper time-based positioning
        const dataPoints = [];

        // If we have very few snapshots, use time-based numeric positions
        const useTimestamps = snapshotDates.length <= 2;

        if (useTimestamps && trophyTimeline.dates.length > 0) {
            // Get time range
            const firstDate = new Date(trophyTimeline.dates[0]);
            const lastDate = new Date(trophyTimeline.dates[trophyTimeline.dates.length - 1]);
            const timeRange = lastDate - firstDate;

            // If only one point or all points at same time, space them out evenly
            if (timeRange === 0 || trophyTimeline.dates.length === 1) {
                trophyTimeline.dates.forEach((date, i) => {
                    const xPos = trophyTimeline.dates.length === 1 ? 0.5 : i / (trophyTimeline.dates.length - 1);
                    dataPoints.push({
                        x: xPos,
                        y: trophyTimeline.trophies[i],
                        source: trophyTimeline.sources[i],
                        dateStr: date,
                        timestamp: new Date(date)
                    });
                });
            } else {
                // Normal time-based positioning
                trophyTimeline.dates.forEach((date, i) => {
                    const timestamp = new Date(date);
                    const xPos = (timestamp - firstDate) / timeRange;
                    dataPoints.push({
                        x: xPos,
                        y: trophyTimeline.trophies[i],
                        source: trophyTimeline.sources[i],
                        dateStr: date,
                        timestamp: timestamp
                    });
                });
            }
        } else {
            // Use snapshot-indexed x-axis (for longer periods)
            trophyTimeline.dates.forEach((date, i) => {
                const source = trophyTimeline.sources[i];
                let xPos = 0;

                if (source === 'snapshot') {
                    const dateOnly = date.split('T')[0];
                    xPos = snapshotDates.indexOf(dateOnly);
                } else {
                    // Battle point - interpolate position
                    const battleDate = new Date(date);

                    let nextSnapshotIdx = -1;
                    for (let j = 0; j < snapshotDates.length; j++) {
                        const snapshotDate = new Date(trophyTimeline.snapshotTimestamps[j]);
                        if (battleDate < snapshotDate) {
                            nextSnapshotIdx = j;
                            break;
                        }
                    }

                    if (nextSnapshotIdx >= 0) {
                        const prevSnapshotIdx = Math.max(0, nextSnapshotIdx - 1);
                        const prevSnapshotTime = new Date(trophyTimeline.snapshotTimestamps[prevSnapshotIdx]);
                        const nextSnapshotTime = new Date(trophyTimeline.snapshotTimestamps[nextSnapshotIdx]);

                        const totalRange = nextSnapshotTime - prevSnapshotTime;
                        const battleOffset = battleDate - prevSnapshotTime;
                        const fraction = battleOffset / totalRange;

                        xPos = prevSnapshotIdx + fraction;
                    } else {
                        // Battle after all snapshots
                        const lastIdx = Math.max(0, snapshotDates.length - 1);
                        if (trophyTimeline.snapshotTimestamps[lastIdx]) {
                            const lastSnapshotTime = new Date(trophyTimeline.snapshotTimestamps[lastIdx]);
                            const hoursSince = (battleDate - lastSnapshotTime) / (1000 * 60 * 60);
                            const dayFraction = Math.min(hoursSince / 24, 1);
                            xPos = lastIdx + dayFraction;
                        } else {
                            xPos = lastIdx;
                        }
                    }
                }

                dataPoints.push({
                    x: xPos,
                    y: trophyTimeline.trophies[i],
                    source: trophyTimeline.sources[i],
                    dateStr: date
                });
            });
        }

        // Sort by x position
        dataPoints.sort((a, b) => a.x - b.x);

        // Configure x-axis
        let xAxisConfig;
        if (useTimestamps) {
            // Time-based numeric axis with formatted labels
            xAxisConfig = {
                type: 'linear',
                min: 0,
                max: 1,
                ticks: {
                    color: '#9ba3af',
                    maxRotation: 45,
                    minRotation: 45,
                    autoSkip: true,
                    maxTicksLimit: 10,
                    callback: function(value) {
                        // Find closest point to this value
                        let closest = dataPoints[0];
                        let minDiff = Math.abs(dataPoints[0].x - value);
                        for (const point of dataPoints) {
                            const diff = Math.abs(point.x - value);
                            if (diff < minDiff) {
                                minDiff = diff;
                                closest = point;
                            }
                        }
                        if (closest && closest.timestamp) {
                            const time = closest.timestamp;
                            return `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
                        }
                        return '';
                    }
                },
                grid: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Time',
                    color: '#e8eaed'
                }
            };
        } else {
            xAxisConfig = {
                type: 'linear',
                min: 0,
                max: Math.max(snapshotDates.length - 1, 1),
                ticks: {
                    color: '#9ba3af',
                    maxRotation: 45,
                    minRotation: 45,
                    stepSize: 1,
                    callback: function(value) {
                        const idx = Math.round(value);
                        return snapshotDates[idx] || '';
                    }
                },
                grid: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Date',
                    color: '#e8eaed'
                }
            };
        }

        const ctx = document.getElementById('playerTrophyTimelineChart').getContext('2d');
        this.trophyTimelineChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Trophies',
                    data: dataPoints,
                    borderColor: '#4a9eff',
                    backgroundColor: 'rgba(74, 158, 255, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: (context) => {
                        return context.raw.source === 'snapshot' ? 3 : 0;
                    },
                    pointHoverRadius: (context) => {
                        return context.raw.source === 'snapshot' ? 6 : 3;
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'nearest',
                    intersect: false,
                    axis: 'x'
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            color: '#9ba3af',
                            callback: value => value.toLocaleString()
                        },
                        grid: {
                            color: '#3a4556'
                        },
                        title: {
                            display: true,
                            text: 'Trophies',
                            color: '#e8eaed'
                        }
                    },
                    x: xAxisConfig
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        filter: (tooltipItem) => {
                            return tooltipItem.raw && tooltipItem.raw.source === 'snapshot';
                        },
                        callbacks: {
                            title: (context) => {
                                if (!context || !context[0] || !context[0].raw) return '';
                                const dateStr = context[0].raw.dateStr;
                                return dateStr.split('T')[0];
                            },
                            label: (context) => {
                                if (!context || !context.parsed) return '';
                                return `Trophies: ${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                }
            }
        });
    },

    createModeDistributionChart(playerTag) {
        if (this.modeChart) {
            this.modeChart.destroy();
        }

        const battles = BattlelogDataManager.getBattlesForPlayer(playerTag);
        const modeCounts = {};

        battles.forEach(b => {
            const mode = BattlelogHelpers.getBattleMode(b);
            modeCounts[mode] = (modeCounts[mode] || 0) + 1;
        });

        const modeData = Object.entries(modeCounts)
            .sort((a, b) => b[1] - a[1]);

        const labels = modeData.map(([mode]) => mode);
        const data = modeData.map(([, count]) => count);

        const canvas = document.getElementById('playerModeChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        this.modeChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: GameConstants.COLOR_PALETTE.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#252d3d'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#ffffff',
                            padding: 15,
                            font: {
                                size: 12,
                                weight: '500'
                            },
                            boxWidth: 15,
                            boxHeight: 15,
                            generateLabels: function(chart) {
                                const data = chart.data;
                                const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return {
                                        text: `${label}: ${percentage}%`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        hidden: false,
                                        index: i,
                                        fontColor: '#ffffff'
                                    };
                                });
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        callbacks: {
                            label: context => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const value = context.parsed;
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: ${value} games (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    createActivityHeatmap(playerTag) {
        if (this.activityHeatmap) {
            this.activityHeatmap.destroy();
        }

        const battles = BattlelogDataManager.getBattlesForPlayer(playerTag);

        // Create 7x24 grid for day of week x hour
        const heatmapData = {};
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        // Initialize grid
        for (let day = 0; day < 7; day++) {
            for (let hour = 0; hour < 24; hour++) {
                heatmapData[`${day}-${hour}`] = 0;
            }
        }

        // Count battles per hour/day
        battles.forEach(b => {
            const date = Utils.parseBattleTime(b.battleTime);
            if (!date) return;
            const day = date.getDay(); // 0 = Sunday
            const hour = date.getHours();
            heatmapData[`${day}-${hour}`]++;
        });

        // Convert to Chart.js matrix format
        const dataPoints = [];
        for (let day = 0; day < 7; day++) {
            for (let hour = 0; hour < 24; hour++) {
                dataPoints.push({
                    x: hour,
                    y: days[day],
                    v: heatmapData[`${day}-${hour}`]
                });
            }
        }

        const canvas = document.getElementById('playerActivityHeatmap');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        this.activityHeatmap = new Chart(ctx, {
            type: 'matrix',
            data: {
                datasets: [{
                    label: 'Battles',
                    data: dataPoints,
                    backgroundColor(context) {
                        const value = context.dataset.data[context.dataIndex].v;
                        if (value === 0) return 'rgba(37, 45, 61, 0.3)';
                        const alpha = Math.min(0.2 + (value / 10) * 0.8, 1);
                        return `rgba(74, 158, 255, ${alpha})`;
                    },
                    borderColor: '#252d3d',
                    borderWidth: 1,
                    width: ({ chart }) => (chart.chartArea || {}).width / 24 - 1,
                    height: ({ chart }) => (chart.chartArea || {}).height / 7 - 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        callbacks: {
                            title(context) {
                                const item = context[0].raw;
                                return `${item.y}, ${item.x}:00`;
                            },
                            label(context) {
                                const value = context.raw.v;
                                return `${value} battle${value !== 1 ? 's' : ''}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: 0,
                        max: 23,
                        ticks: {
                            stepSize: 1,
                            color: '#9ba3af',
                            callback: value => `${value}:00`
                        },
                        grid: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: 'Hour of Day',
                            color: '#e8eaed'
                        }
                    },
                    y: {
                        type: 'category',
                        labels: days,
                        ticks: {
                            color: '#9ba3af'
                        },
                        grid: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: 'Day of Week',
                            color: '#e8eaed'
                        }
                    }
                }
            }
        });
    }
};
