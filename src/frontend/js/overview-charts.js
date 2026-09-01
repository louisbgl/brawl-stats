/**
 * OverviewCharts - Chart renderers for Overview tab
 *
 * Dependencies: Chart.js, common.js (GameConfig)
 */

const OverviewCharts = {
    /**
     * Render trophy timeline chart
     * @param {HTMLElement} container - Container element for chart
     * @param {Array} timelineData - Array of {date, players: {tag: trophies}}
     * @param {number} days - Number of days to show (7, 30, 90, or null for all)
     * @param {boolean} showGains - Show gains from baseline instead of absolute trophies
     * @returns {Chart} Chart.js instance
     */
    renderTrophyTimeline(container, timelineData, days = 30, showGains = false) {
        // Clear container
        container.innerHTML = '<canvas id="trophyTimelineChart"></canvas>';
        const canvas = container.querySelector('canvas');
        const ctx = canvas.getContext('2d');

        // Detect mobile
        const isMobile = window.innerWidth <= 768;

        // Filter timeline by date range
        const filteredData = days
            ? timelineData.slice(-days)
            : timelineData;

        // Extract dates
        const dates = filteredData.map(d => d.date);

        // Get all unique player tags
        const allTags = new Set();
        filteredData.forEach(point => {
            Object.keys(point.players).forEach(tag => allTags.add(tag));
        });

        // Get player index for names
        const playerIndex = DataLoader.getPlayerIndex();

        // Create dataset per player
        const datasets = Array.from(allTags).map(tag => {
            const playerName = playerIndex[tag]?.name || tag;
            const color = GameConfig.getPlayerChartColor(tag);

            const rawData = filteredData.map(point => point.players[tag] || null);

            // Transform data if showing gains
            let data;
            if (showGains) {
                // Find first non-null value as baseline
                const baseline = rawData.find(val => val !== null) || 0;
                // Calculate gains from baseline
                data = rawData.map(val => val !== null ? val - baseline : null);
            } else {
                data = rawData;
            }

            return {
                label: playerName,
                data: data,
                borderColor: color,
                backgroundColor: color + '33', // 20% opacity
                borderWidth: 2,
                tension: 0.3,
                fill: false,
                pointRadius: 0,
                pointHoverRadius: 4,
                spanGaps: true // Connect lines even if player missing some days
            };
        });

        // Create chart
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                layout: {
                    padding: {
                        bottom: 10
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            color: '#e0e0e0',
                            padding: isMobile ? 8 : 20,
                            usePointStyle: true,
                            boxHeight: isMobile ? 6 : 8,
                            font: {
                                size: isMobile ? 9 : 12
                            }
                        },
                        onClick: (e, legendItem, legend) => {
                            // Default Chart.js behavior
                            const index = legendItem.datasetIndex;
                            const chart = legend.chart;
                            const meta = chart.getDatasetMeta(index);
                            meta.hidden = !meta.hidden;
                            chart.update();

                            // Trigger custom callback if provided
                            if (chart.options.onLegendClick) {
                                chart.options.onLegendClick(chart);
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 26, 46, 0.95)',
                        titleColor: '#e0e0e0',
                        bodyColor: '#e0e0e0',
                        borderColor: '#3a3a5a',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        itemSort: (a, b) => {
                            // Sort by value descending (highest first)
                            return b.parsed.y - a.parsed.y;
                        },
                        callbacks: {
                            title: (items) => {
                                return items[0].label; // Date
                            },
                            label: (context) => {
                                const value = context.parsed.y;
                                if (showGains) {
                                    const sign = value >= 0 ? '+' : '';
                                    return `${context.dataset.label}: ${sign}${value.toLocaleString()}`;
                                } else {
                                    return `${context.dataset.label}: ${value.toLocaleString()}`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#2a2a4a',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#8a8a9a',
                            maxRotation: 45,
                            minRotation: 45,
                            font: {
                                size: isMobile ? 8 : 11
                            },
                            maxTicksLimit: isMobile ? 6 : undefined
                        }
                    },
                    y: {
                        beginAtZero: showGains, // Start at 0 for gains mode
                        grid: {
                            color: '#2a2a4a',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#8a8a9a',
                            callback: (value) => {
                                if (showGains) {
                                    const sign = value > 0 ? '+' : '';
                                    return sign + value.toLocaleString();
                                }
                                return value.toLocaleString();
                            },
                            font: {
                                size: isMobile ? 8 : 11
                            },
                            maxTicksLimit: isMobile ? 5 : undefined
                        }
                    }
                }
            }
        });

        return chart;
    }
};
