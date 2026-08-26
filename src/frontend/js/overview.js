/**
 * OverviewManager - Renders the Overview tab (v2)
 * Shows club stats from aggregated data
 */

const OverviewManager = {
    /**
     * Render the Overview tab with real data
     */
    async render() {
        const clubSummary = await DataLoader.getClubSummary();
        if (!clubSummary) {
            console.error('Cannot render Overview: club-summary.json not loaded');
            return;
        }

        console.log('Rendering Overview tab with data:', clubSummary);

        this.renderStatCards(clubSummary);
        this.renderChartPlaceholders();
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

        console.log('Stat cards updated from quick_stats:', stats);
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
     * Show chart loading placeholders
     */
    renderChartPlaceholders() {
        const trophyChart = document.querySelector('#overview .card:nth-of-type(2) .placeholder');
        const leaderboardChart = document.querySelector('#overview .card:nth-of-type(3) .placeholder');

        if (trophyChart) {
            trophyChart.textContent = 'Charts not implemented yet - historical data loading in background';
        }

        if (leaderboardChart) {
            leaderboardChart.textContent = 'Leaderboard not implemented yet';
        }
    }
};
