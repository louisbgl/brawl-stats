/**
 * OverviewManager - Renders the Overview tab (v2)
 * Shows club stats from aggregated data
 *
 * Dependencies: overview-charts.js, common.js
 */

const OverviewManager = {
    currentChart: null,
    currentTimeRange: 30,
    showGains: false, // Toggle between absolute trophies and gains from baseline
    hiddenPlayers: new Set(), // Track hidden player tags
    currentLeaderboardCategory: 'trophies', // Track active leaderboard category
    skipNextRender: false, // Skip re-render when we update URL programmatically
    forceResetChart: false, // Force full chart reset (don't save hidden state)

    /**
     * Validate time range is allowed value
     */
    isValidTimeRange(range) {
        if (range === null || range === 'all') return true;
        return [7, 30, 90].includes(parseInt(range));
    },

    /**
     * Validate player tag exists in club
     */
    isValidPlayerTag(tag, clubSummary) {
        if (!tag) return false;
        return clubSummary.leaderboards.trophies.some(entry => entry.tag === tag);
    },

    /**
     * Validate leaderboard category exists
     */
    isValidLeaderboardCategory(category, clubSummary) {
        if (!category) return false;
        return clubSummary.leaderboards.hasOwnProperty(category);
    },

    /**
     * Render the Overview tab with real data
     */
    async render(urlFilters = []) {
        if (this.skipNextRender) {
            this.skipNextRender = false;
            return;
        }

        const clubSummary = await DataLoader.getClubSummary();
        if (!clubSummary) {
            console.error('Cannot render Overview: club-summary.json not loaded');
            return;
        }

        // Parse URL filters: [timeRange, showGains, hiddenPlayers, leaderboardCategory]
        if (urlFilters.length > 0 && urlFilters[0]) {
            // URL has params - validate time range
            const rangeParam = urlFilters[0];

            if (!this.isValidTimeRange(rangeParam)) {
                console.warn(`Invalid time range in URL: ${rangeParam}`);
                localStorage.removeItem('overview.timeRange');
                // Load other state from localStorage, use default time range
                this.loadState();
                this.currentTimeRange = 30; // Force default
                this.updateURL(); // Clean URL
                this.renderStatCards(clubSummary);
                this.renderTrophyChart(clubSummary);
                this.renderLeaderboard(clubSummary);
                return;
            }

            this.currentTimeRange = rangeParam === 'all' ? null : parseInt(rangeParam);

            // Parse showGains toggle (position 1, right after timeRange)
            if (urlFilters[1]) {
                this.showGains = urlFilters[1] === 'gains';
            } else {
                this.showGains = false;
            }

            // Validate hidden player tags (now position 2)
            let urlWasInvalid = false;
            if (urlFilters[2]) {
                const hiddenTags = urlFilters[2].split(',').filter(t => t);
                const invalidTags = hiddenTags.filter(tag => !this.isValidPlayerTag(tag, clubSummary));

                if (invalidTags.length > 0) {
                    console.warn(`Invalid player tags in URL - resetting to show all: ${invalidTags.join(', ')}`);
                    this.hiddenPlayers = new Set(); // Reset to default (show all)
                    this.forceResetChart = true; // Force full chart reset
                    urlWasInvalid = true;
                } else {
                    this.hiddenPlayers = new Set(hiddenTags);
                }
            } else {
                this.hiddenPlayers = new Set();
            }

            // Validate leaderboard category (now position 3)
            if (urlFilters[3]) {
                const category = urlFilters[3];
                if (this.isValidLeaderboardCategory(category, clubSummary)) {
                    this.currentLeaderboardCategory = category;
                } else {
                    console.warn(`Invalid leaderboard category in URL: ${category}`);
                    this.currentLeaderboardCategory = 'trophies';
                    urlWasInvalid = true;
                }
            } else {
                this.currentLeaderboardCategory = 'trophies';
            }

            // Save to localStorage (will save cleaned values)
            this.saveState();

            // Update URL if we cleaned invalid values
            if (urlWasInvalid) {
                // Use replaceState to update URL without triggering router
                window.history.replaceState(null, '', '#' + this.buildURL());
                // Continue to render with cleaned values (don't return)
            }
        } else {
            // No URL params - load from localStorage
            this.loadState();

            // Validate loaded time range
            if (!this.isValidTimeRange(this.currentTimeRange)) {
                console.warn(`Invalid time range in localStorage: ${this.currentTimeRange}`);
                localStorage.removeItem('overview.timeRange');
                this.currentTimeRange = 30; // Force default
            }

            // Validate hidden player tags
            const invalidTags = Array.from(this.hiddenPlayers).filter(tag => !this.isValidPlayerTag(tag, clubSummary));

            if (invalidTags.length > 0) {
                console.warn(`Invalid player tags in localStorage - resetting to show all: ${invalidTags.join(', ')}`);
                this.hiddenPlayers = new Set(); // Reset to default (show all)
                this.forceResetChart = true; // Force full chart reset
                localStorage.removeItem('overview.hiddenPlayers');
            }

            // Validate leaderboard category
            if (!this.isValidLeaderboardCategory(this.currentLeaderboardCategory, clubSummary)) {
                console.warn(`Invalid leaderboard category in localStorage: ${this.currentLeaderboardCategory}`);
                localStorage.removeItem('overview.leaderboardCategory');
                this.currentLeaderboardCategory = 'trophies';
            }

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
        localStorage.setItem('overview.showGains', this.showGains.toString());
    },

    loadState() {
        const savedRange = localStorage.getItem('overview.timeRange');
        const savedHidden = localStorage.getItem('overview.hiddenPlayers');
        const savedCategory = localStorage.getItem('overview.leaderboardCategory');
        const savedShowGains = localStorage.getItem('overview.showGains');

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

        if (savedShowGains) {
            this.showGains = savedShowGains === 'true';
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
        const chartCard = document.querySelector('#tab-overview .card:nth-of-type(2)');
        if (!chartCard) return;

        chartCard.innerHTML = `
            <h2 style="text-align: center; margin-bottom: 16px;">Trophy Progression</h2>
            <div style="text-align: center; margin-bottom: 20px; display: flex; gap: 20px; justify-content: center; align-items: center;">
                <div class="time-range-controls">
                    <button class="time-range-btn ${this.currentTimeRange === 7 ? 'active' : ''}" data-days="7">7 Days</button>
                    <button class="time-range-btn ${this.currentTimeRange === 30 ? 'active' : ''}" data-days="30">30 Days</button>
                    <button class="time-range-btn ${this.currentTimeRange === 90 ? 'active' : ''}" data-days="90">90 Days</button>
                    <button class="time-range-btn ${this.currentTimeRange === null ? 'active' : ''}" data-days="all">All Time</button>
                </div>
                <div class="time-range-controls">
                    <button class="time-range-btn ${!this.showGains ? 'active' : ''}" data-mode="absolute">Total</button>
                    <button class="time-range-btn ${this.showGains ? 'active' : ''}" data-mode="gains">Gains</button>
                </div>
            </div>
            <div class="chart-container" style="position: relative; height: 400px;"></div>
        `;

        const chartContainer = chartCard.querySelector('.chart-container');

        // Save current hidden state before destroying (unless forcing reset)
        if (this.currentChart) {
            if (!this.forceResetChart) {
                this.currentChart.data.datasets.forEach((dataset, idx) => {
                    const meta = this.currentChart.getDatasetMeta(idx);
                    if (meta.hidden) {
                        // Find player tag by dataset label
                        const playerIndex = DataLoader.getPlayerIndex();
                        const tag = Object.keys(playerIndex).find(t => playerIndex[t].name === dataset.label);
                        if (tag) this.hiddenPlayers.add(tag);
                    }
                });
            }
            this.currentChart.destroy();
            this.forceResetChart = false; // Reset flag
        }

        // Render chart
        this.currentChart = OverviewCharts.renderTrophyTimeline(
            chartContainer,
            clubSummary.trophy_timeline,
            this.currentTimeRange,
            this.showGains
        );

        // Restore hidden state by toggling dataset visibility
        const playerIndex = DataLoader.getPlayerIndex();
        this.currentChart.data.datasets.forEach((dataset, idx) => {
            const tag = Object.keys(playerIndex).find(t => playerIndex[t].name === dataset.label);
            const shouldBeHidden = tag && this.hiddenPlayers.has(tag);

            // Use Chart.js setDatasetVisibility API
            this.currentChart.setDatasetVisibility(idx, !shouldBeHidden);
        });
        this.currentChart.update('none'); // Force immediate update without animation

        // Setup time range button handlers
        chartCard.querySelectorAll('.time-range-btn[data-days]').forEach(btn => {
            btn.addEventListener('click', () => {
                const days = btn.dataset.days === 'all' ? null : parseInt(btn.dataset.days);
                this.currentTimeRange = days;
                this.updateURL();
                this.renderTrophyChart(clubSummary);
            });
        });

        // Setup mode toggle button handlers
        chartCard.querySelectorAll('.time-range-btn[data-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.showGains = btn.dataset.mode === 'gains';
                this.saveState();
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

    buildURL() {
        const isDefaultTimeRange = this.currentTimeRange === 30;
        const isDefaultShowGains = !this.showGains;
        const isDefaultLeaderboard = this.currentLeaderboardCategory === 'trophies';
        const hasHiddenPlayers = this.hiddenPlayers.size > 0;

        // Build target URL: overview/[timeRange]/[showGains]/[hiddenPlayers]/[leaderboardCategory]
        if (isDefaultTimeRange && isDefaultShowGains && isDefaultLeaderboard && !hasHiddenPlayers) {
            return 'overview';
        }

        const rangeParam = this.currentTimeRange === null ? 'all' : this.currentTimeRange;
        const showGainsParam = this.showGains ? 'gains' : '';
        const hiddenParam = hasHiddenPlayers ? Array.from(this.hiddenPlayers).join(',') : '';

        let targetURL = `overview/${rangeParam}`;

        // Add showGains param (position 1)
        if (showGainsParam || hiddenParam || !isDefaultLeaderboard) {
            targetURL += `/${showGainsParam}`;
        }

        // Add hiddenPlayers param (position 2)
        if (hiddenParam) {
            targetURL += `/${hiddenParam}`;
        } else if (!isDefaultLeaderboard) {
            targetURL += `/`;
        }

        // Add leaderboardCategory param (position 3)
        if (!isDefaultLeaderboard) {
            targetURL += `/${this.currentLeaderboardCategory}`;
        }

        return targetURL;
    },

    updateURL() {
        // Skip re-render on hash change (we already updated UI)
        this.skipNextRender = true;
        window.location.hash = this.buildURL();
    },

    /**
     * Render club leaderboard
     */
    renderLeaderboard(clubSummary) {
        const leaderboardCard = document.querySelector('#tab-overview .card:nth-of-type(3)');
        if (!leaderboardCard) return;

        // Remove placeholder, keep h2
        const placeholder = leaderboardCard.querySelector('.placeholder');
        if (placeholder) placeholder.remove();

        // Create or re-use container for leaderboard
        let container = leaderboardCard.querySelector('.leaderboard-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'leaderboard-container';
            leaderboardCard.appendChild(container);
        }

        // Always render with current category
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
};
