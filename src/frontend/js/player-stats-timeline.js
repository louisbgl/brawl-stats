/**
 * PlayerStatsTimeline - Trophy progression chart
 *
 * Dependencies: Chart.js, common.js
 */

const PlayerStatsTimeline = {
    /**
     * Render trophy timeline with filters
     */
    render(timelineData, tag, currentTimelineRange, onRangeChange) {
        const content = document.querySelector('.player-stats-content');
        if (!content) return;

        const playerColor = GameConfig.getPlayerChartColor(tag);

        // Calculate trophy gain for current range
        const gainStats = this.calculateTrophyGain(timelineData.trophy_progression, currentTimelineRange);

        // Create card container
        const cardHTML = `
            <div class="card" style="margin-top: 32px;">
                <h2 style="text-align: center; margin-bottom: 20px;">Trophy Progression</h2>

                <!-- Trophy stat centered, selectors snapped to 1/4 and 3/4 points -->
                <div style="position: relative; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; min-height: 50px;">
                    <div class="time-range-controls" style="position: absolute; left: 25%; transform: translateX(-50%);">
                        <button class="time-range-btn ${currentTimelineRange === 7 ? 'active' : ''}" data-days="7">7 Days</button>
                        <button class="time-range-btn ${currentTimelineRange === 30 ? 'active' : ''}" data-days="30">30 Days</button>
                        <button class="time-range-btn ${currentTimelineRange === 90 ? 'active' : ''}" data-days="90">90 Days</button>
                        <button class="time-range-btn ${currentTimelineRange === null ? 'active' : ''}" data-days="all">All Time</button>
                    </div>

                    <div class="gain-value" style="font-size: 1rem; font-weight: 700; color: ${gainStats.change >= 0 ? 'var(--accent-green)' : 'var(--accent-pink)'}; white-space: nowrap;">
                        ${gainStats.change >= 0 ? '+' : ''}${gainStats.change.toLocaleString()} 🏆 (${gainStats.percent >= 0 ? '+' : ''}${gainStats.percent}%)
                    </div>

                    <!-- TODO: Multi-select brawler filter
                         - Load from brawler-timelines.json (lazy)
                         - Allow selecting multiple brawlers to overlay on chart
                         - Each brawler = separate colored line
                         - "All Brawlers" shows account total (current behavior)
                         - Save to localStorage and URL (similar to time range)
                    -->
                    <div class="time-range-controls" style="position: absolute; left: 75%; transform: translateX(-50%);">
                        <button class="time-range-btn" disabled style="opacity: 0.4; cursor: not-allowed;">Brawler Filter (Soon)</button>
                    </div>
                </div>

                <div class="chart-container" style="position: relative; height: 400px;"></div>
            </div>
        `;

        content.insertAdjacentHTML('beforeend', cardHTML);

        // Render chart
        const chartContainer = content.querySelector('.chart-container');
        const chart = this.renderChart(chartContainer, timelineData, playerColor, currentTimelineRange);

        // Setup time range button handlers
        content.querySelectorAll('.time-range-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;

                const days = btn.dataset.days === 'all' ? null : parseInt(btn.dataset.days);

                // Update button states
                content.querySelectorAll('.time-range-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Re-render chart
                if (chart) chart.destroy();
                this.renderChart(chartContainer, timelineData, playerColor, days);

                // Update gain stat
                const gainStats = this.calculateTrophyGain(timelineData.trophy_progression, days);
                const gainValueEl = content.querySelector('.gain-value');
                if (gainValueEl) {
                    gainValueEl.style.color = gainStats.change >= 0 ? 'var(--accent-green)' : 'var(--accent-pink)';
                    gainValueEl.textContent = `${gainStats.change >= 0 ? '+' : ''}${gainStats.change.toLocaleString()} 🏆 (${gainStats.percent >= 0 ? '+' : ''}${gainStats.percent}%)`;
                }

                // Callback to update parent state
                onRangeChange(days);
            });
        });

        return chart;
    },

    /**
     * Calculate trophy gain/loss for current time range
     */
    calculateTrophyGain(progression, timelineRange) {
        let filteredData = progression;
        if (timelineRange !== null) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - timelineRange);
            filteredData = progression.filter(point => new Date(point.date) >= cutoffDate);
        }

        if (filteredData.length < 2) {
            return { change: 0, percent: 0 };
        }

        const first = filteredData[0].trophies;
        const last = filteredData[filteredData.length - 1].trophies;
        const change = last - first;
        const percent = first > 0 ? ((change / first) * 100).toFixed(1) : 0;

        return { change, percent: parseFloat(percent) };
    },

    /**
     * Render the chart
     */
    renderChart(container, timelineData, playerColor, timelineRange) {
        // Filter data by time range
        let filteredData = timelineData.trophy_progression;
        if (timelineRange !== null) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - timelineRange);
            filteredData = filteredData.filter(point => new Date(point.date) >= cutoffDate);
        }

        const labels = filteredData.map(p => p.date);
        const data = filteredData.map(p => p.trophies);

        const canvas = document.createElement('canvas');
        container.innerHTML = '';
        container.appendChild(canvas);

        return new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Trophies',
                    data: data,
                    borderColor: playerColor,
                    backgroundColor: playerColor + '20',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: playerColor,
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: playerColor,
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            title: (items) => {
                                return items[0].label;
                            },
                            label: (item) => {
                                return `${item.parsed.y.toLocaleString()} trophies`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#888',
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#888',
                            callback: (value) => value.toLocaleString()
                        }
                    }
                }
            }
        });
    }
};
