// Player Charts module - handles Chart.js visualizations for individual players

const PlayerChartsManager = {
    prestigeChart: null,
    powerChart: null,
    trophyTimelineChart: null,

    createPrestigeChart(prestigeStats) {
        if (this.prestigeChart) {
            this.prestigeChart.destroy();
        }

        const labels = ['<1k', '1k-2k', '2k-3k', '3k-4k', '4k-5k', '5k+'];
        const data = [prestigeStats[0], prestigeStats[1], prestigeStats[2], prestigeStats[3], prestigeStats[4], prestigeStats[5]];

        const ctx = document.getElementById('playerPrestigeChart').getContext('2d');
        this.prestigeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Brawlers',
                    data: data,
                    backgroundColor: ['#4a9eff', '#9d4edd', '#06d6a0', '#ff9f1c', '#ef476f', '#118ab2']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: '#9ba3af'
                        },
                        grid: {
                            color: '#3a4556'
                        },
                        title: {
                            display: true,
                            text: 'Number of Brawlers',
                            color: '#e8eaed'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#9ba3af'
                        },
                        grid: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: 'Prestige Level',
                            color: '#e8eaed'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        callbacks: {
                            label: context => `${context.parsed.y} brawler${context.parsed.y !== 1 ? 's' : ''}`
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 25
                    }
                },
                animation: {
                    onComplete: function() {
                        const chartInstance = this;
                        const ctx = chartInstance.ctx;
                        ctx.font = '12px sans-serif';
                        ctx.fillStyle = '#e8eaed';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';

                        this.data.datasets.forEach((dataset, i) => {
                            const meta = chartInstance.getDatasetMeta(i);
                            meta.data.forEach((bar, index) => {
                                const data = dataset.data[index];
                                if (data > 0) {
                                    ctx.fillText(data, bar.x, bar.y - 5);
                                }
                            });
                        });
                    }
                }
            }
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
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: '#9ba3af'
                        },
                        grid: {
                            color: '#3a4556'
                        },
                        title: {
                            display: true,
                            text: 'Number of Brawlers',
                            color: '#e8eaed'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#9ba3af'
                        },
                        grid: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: 'Power Level',
                            color: '#e8eaed'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        callbacks: {
                            label: context => `${context.parsed.y} brawler${context.parsed.y !== 1 ? 's' : ''}`
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 25
                    }
                },
                animation: {
                    onComplete: function() {
                        const chartInstance = this;
                        const ctx = chartInstance.ctx;
                        ctx.font = '12px sans-serif';
                        ctx.fillStyle = '#e8eaed';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';

                        this.data.datasets.forEach((dataset, i) => {
                            const meta = chartInstance.getDatasetMeta(i);
                            meta.data.forEach((bar, index) => {
                                const data = dataset.data[index];
                                if (data > 0) {
                                    ctx.fillText(data, bar.x, bar.y - 5);
                                }
                            });
                        });
                    }
                }
            }
        });
    },

    createPlayerTrophyChart(trophyTimeline) {
        if (this.trophyTimelineChart) {
            this.trophyTimelineChart.destroy();
        }

        if (trophyTimeline.dates.length === 0) {
            return;
        }

        const ctx = document.getElementById('playerTrophyTimelineChart').getContext('2d');
        this.trophyTimelineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trophyTimeline.dates,
                datasets: [{
                    label: 'Trophies',
                    data: trophyTimeline.trophies,
                    borderColor: '#4a9eff',
                    backgroundColor: 'rgba(74, 158, 255, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
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
                    x: {
                        ticks: {
                            color: '#9ba3af',
                            maxRotation: 45,
                            minRotation: 45
                        },
                        grid: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: 'Date',
                            color: '#e8eaed'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        callbacks: {
                            label: context => `Trophies: ${context.parsed.y.toLocaleString()}`
                        }
                    }
                }
            }
        });
    }
};
