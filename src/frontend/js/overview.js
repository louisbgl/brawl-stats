/**
 * OverviewManager - Renders the Overview tab (v2)
 * Shows club stats from aggregated data
 *
 * Dependencies: overview-charts.js, common.js
 */

const OverviewManager = {
    currentChart: null,
    currentTimeRange: 30,

    /**
     * Render the Overview tab with real data
     */
    async render() {
        const clubSummary = await DataLoader.getClubSummary();
        if (!clubSummary) {
            console.error('Cannot render Overview: club-summary.json not loaded');
            return;
        }

        this.renderStatCards(clubSummary);
        this.renderTrophyChart(clubSummary);
        this.renderLeaderboardPlaceholder();
    },

    /**
     * Render stat cards with real data from club-summary.json
     */
    renderStatCards(clubSummary) {
        const stats = clubSummary.quick_stats;

        // Update stat cards (no 3rd line)
        this.updateStatCard('total-members', {
            value: stats.total_members
        });

        this.updateStatCard('total-trophies', {
            value: stats.total_trophies.toLocaleString()
        });

        this.updateStatCard('total-battles', {
            value: stats.total_battles.toLocaleString()
        });

        this.updateStatCard('avg-winrate', {
            value: `${(stats.avg_winrate * 100).toFixed(1)}%`
        });

        // TODO: Add mode name prettifier/formatter (use GameConstants or similar)
        this.updateStatCard('fav-mode', {
            value: stats.fav_mode
        });
    },

    /**
     * Update a single stat card
     */
    updateStatCard(cardId, { value }) {
        const card = document.querySelector(`[data-stat="${cardId}"]`);
        if (!card) {
            console.warn(`Stat card not found: ${cardId}`);
            return;
        }

        const valueEl = card.querySelector('.stat-value');
        if (valueEl) valueEl.textContent = value;
    },

    /**
     * Render trophy progression chart
     */
    renderTrophyChart(clubSummary) {
        const chartCard = document.querySelector('#overview .card:nth-of-type(2)');
        if (!chartCard) return;

        // Replace placeholder with time range controls + chart container
        chartCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h2>Trophy Progression</h2>
                <div class="time-range-controls">
                    <button class="time-range-btn ${this.currentTimeRange === 7 ? 'active' : ''}" data-days="7">7D</button>
                    <button class="time-range-btn ${this.currentTimeRange === 30 ? 'active' : ''}" data-days="30">30D</button>
                    <button class="time-range-btn ${this.currentTimeRange === 90 ? 'active' : ''}" data-days="90">90D</button>
                    <button class="time-range-btn ${this.currentTimeRange === null ? 'active' : ''}" data-days="all">All</button>
                </div>
            </div>
            <div class="chart-container" style="position: relative; height: 400px;"></div>
        `;

        const chartContainer = chartCard.querySelector('.chart-container');

        // Render chart
        if (this.currentChart) {
            this.currentChart.destroy();
        }
        this.currentChart = OverviewCharts.renderTrophyTimeline(
            chartContainer,
            clubSummary.trophy_timeline,
            this.currentTimeRange
        );

        // Setup time range button handlers
        chartCard.querySelectorAll('.time-range-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const days = btn.dataset.days === 'all' ? null : parseInt(btn.dataset.days);
                this.currentTimeRange = days;
                this.renderTrophyChart(clubSummary);
            });
        });
    },

    /**
     * Show leaderboard placeholder
     */
    renderLeaderboardPlaceholder() {
        const leaderboardCard = document.querySelector('#overview .card:nth-of-type(3) .placeholder');
        if (leaderboardCard) {
            leaderboardCard.textContent = 'Leaderboard not implemented yet';
        }
    }
};
