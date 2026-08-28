/**
 * OverviewManager - Renders the Overview tab (v2)
 * Shows club stats from aggregated data
 *
 * Dependencies: overview-charts.js, common.js
 */

const OverviewManager = {
    currentChart: null,
    currentTimeRange: 30,
    hiddenPlayers: new Set(), // Track hidden player tags
    currentLeaderboardCategory: 'trophies', // Track active leaderboard category
    skipNextRender: false, // Flag to prevent re-render on programmatic URL updates

    /**
     * Render the Overview tab with real data
     */
    async render(urlFilters = []) {
        // Skip render if programmatic URL update
        if (this.skipNextRender) {
            this.skipNextRender = false;
            return;
        }

        const clubSummary = await DataLoader.getClubSummary();
        if (!clubSummary) {
            console.error('Cannot render Overview: club-summary.json not loaded');
            return;
        }

        // Parse URL filters: [timeRange, hiddenPlayers, leaderboardCategory]
        if (urlFilters.length > 0 && urlFilters[0]) {
            // URL has params - use them
            const rangeParam = urlFilters[0];
            this.currentTimeRange = rangeParam === 'all' ? null : parseInt(rangeParam) || 30;

            if (urlFilters[1]) {
                const hiddenTags = urlFilters[1].split(',').filter(t => t);
                this.hiddenPlayers = new Set(hiddenTags);
            } else {
                this.hiddenPlayers = new Set();
            }

            if (urlFilters[2]) {
                this.currentLeaderboardCategory = urlFilters[2] || 'trophies';
            }

            // Save to localStorage
            this.saveState();
        } else {
            // No URL params - load from localStorage
            this.loadState();
            this.updateURL(); // Sync URL with localStorage
        }

        this.renderStatCards(clubSummary);
        this.renderTrophyChart(clubSummary);
        this.renderLeaderboard(clubSummary);
    },

    saveState() {
        localStorage.setItem('overview.timeRange', this.currentTimeRange === null ? 'all' : this.currentTimeRange.toString());
        localStorage.setItem('overview.hiddenPlayers', JSON.stringify(Array.from(this.hiddenPlayers)));
        localStorage.setItem('overview.leaderboardCategory', this.currentLeaderboardCategory);
    },

    loadState() {
        const savedRange = localStorage.getItem('overview.timeRange');
        const savedHidden = localStorage.getItem('overview.hiddenPlayers');
        const savedCategory = localStorage.getItem('overview.leaderboardCategory');

        if (savedRange) {
            this.currentTimeRange = savedRange === 'all' ? null : parseInt(savedRange);
        }

        if (savedHidden) {
            try {
                const hiddenArray = JSON.parse(savedHidden);
                this.hiddenPlayers = new Set(hiddenArray);
            } catch (e) {
                this.hiddenPlayers = new Set();
            }
        }

        if (savedCategory) {
            this.currentLeaderboardCategory = savedCategory;
        }
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

        this.updateStatCard('fav-mode', {
            value: GameConfig.getModeName(stats.fav_mode)
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

        chartCard.innerHTML = `
            <h2 style="text-align: center; margin-bottom: 16px;">Trophy Progression</h2>
            <div style="text-align: center; margin-bottom: 20px;">
                <div class="time-range-controls">
                    <button class="time-range-btn ${this.currentTimeRange === 7 ? 'active' : ''}" data-days="7">7 Days</button>
                    <button class="time-range-btn ${this.currentTimeRange === 30 ? 'active' : ''}" data-days="30">30 Days</button>
                    <button class="time-range-btn ${this.currentTimeRange === 90 ? 'active' : ''}" data-days="90">90 Days</button>
                    <button class="time-range-btn ${this.currentTimeRange === null ? 'active' : ''}" data-days="all">All Time</button>
                </div>
            </div>
            <div class="chart-container" style="position: relative; height: 400px;"></div>
        `;

        const chartContainer = chartCard.querySelector('.chart-container');

        // Save current hidden state before destroying
        if (this.currentChart) {
            this.currentChart.data.datasets.forEach((dataset, idx) => {
                const meta = this.currentChart.getDatasetMeta(idx);
                if (meta.hidden) {
                    // Find player tag by dataset label
                    const playerIndex = DataLoader.getPlayerIndex();
                    const tag = Object.keys(playerIndex).find(t => playerIndex[t].name === dataset.label);
                    if (tag) this.hiddenPlayers.add(tag);
                }
            });
            this.currentChart.destroy();
        }

        // Render chart
        this.currentChart = OverviewCharts.renderTrophyTimeline(
            chartContainer,
            clubSummary.trophy_timeline,
            this.currentTimeRange
        );

        // Restore hidden state
        const playerIndex = DataLoader.getPlayerIndex();
        this.currentChart.data.datasets.forEach((dataset, idx) => {
            const tag = Object.keys(playerIndex).find(t => playerIndex[t].name === dataset.label);
            if (tag && this.hiddenPlayers.has(tag)) {
                const meta = this.currentChart.getDatasetMeta(idx);
                meta.hidden = true;
            }
        });
        this.currentChart.update();

        // Setup time range button handlers
        chartCard.querySelectorAll('.time-range-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const days = btn.dataset.days === 'all' ? null : parseInt(btn.dataset.days);
                this.currentTimeRange = days;
                this.updateURL();
                this.renderTrophyChart(clubSummary);
            });
        });

        // Setup legend click handler to update URL
        this.currentChart.options.onLegendClick = (chart) => {
            // Sync hiddenPlayers and URL after legend click
            this.hiddenPlayers.clear();
            chart.data.datasets.forEach((dataset, idx) => {
                const meta = chart.getDatasetMeta(idx);
                if (meta.hidden) {
                    const playerIndex = DataLoader.getPlayerIndex();
                    const tag = Object.keys(playerIndex).find(t => playerIndex[t].name === dataset.label);
                    if (tag) this.hiddenPlayers.add(tag);
                }
            });
            this.updateURL();
        };
    },

    updateURL() {
        const isDefaultTimeRange = this.currentTimeRange === 30;
        const isDefaultLeaderboard = this.currentLeaderboardCategory === 'trophies';
        const hasHiddenPlayers = this.hiddenPlayers.size > 0;

        // If everything is default, just show "overview"
        if (isDefaultTimeRange && isDefaultLeaderboard && !hasHiddenPlayers) {
            this.skipNextRender = true;
            window.location.hash = 'overview';
            return;
        }

        const rangeParam = this.currentTimeRange === null ? 'all' : this.currentTimeRange;
        const hiddenParam = hasHiddenPlayers ? Array.from(this.hiddenPlayers).join(',') : '';

        let url = `overview/${rangeParam}`;
        if (hiddenParam) {
            url += `/${hiddenParam}`;
        } else if (!isDefaultLeaderboard) {
            // Need to preserve leaderboard category even if no hidden players
            url += `/`;
        }

        if (!isDefaultLeaderboard) {
            url += `/${this.currentLeaderboardCategory}`;
        }

        // Set flag to skip next render (programmatic update)
        this.skipNextRender = true;
        window.location.hash = url;
    },

    /**
     * Render club leaderboard
     */
    renderLeaderboard(clubSummary) {
        const leaderboardCard = document.querySelector('#overview .card:nth-of-type(3)');
        if (!leaderboardCard) return;

        // Remove placeholder, keep h2
        const placeholder = leaderboardCard.querySelector('.placeholder');
        if (placeholder) placeholder.remove();

        // Create container for leaderboard
        let container = leaderboardCard.querySelector('.leaderboard-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'leaderboard-container';
            leaderboardCard.appendChild(container);

            // Initial render only
            OverviewLeaderboard.render(
                container,
                clubSummary.leaderboards,
                this.currentLeaderboardCategory,
                (category) => {
                    this.currentLeaderboardCategory = category;
                    this.saveState();
                    this.updateURL();
                }
            );
        }
    }
};
