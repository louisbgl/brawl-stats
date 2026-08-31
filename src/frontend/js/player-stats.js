/**
 * PlayerStatsManager - Player Stats tab
 * Player selection and detailed stats display
 *
 * Dependencies: data.js, config.js
 */

const PlayerStatsManager = {
    selectedPlayerTag: null,
    currentTimelineRange: 30, // Default to 30 days
    currentChart: null,

    /**
     * Validate player tag exists in club
     */
    isValidPlayerTag(tag, clubSummary) {
        if (!tag) return false;
        return clubSummary.leaderboards.trophies.some(entry => entry.tag === tag);
    },

    /**
     * Validate time range is allowed value
     */
    isValidTimeRange(range) {
        if (range === null || range === 'all') return true;
        return [7, 30, 90].includes(parseInt(range));
    },

    /**
     * Render the Player Stats tab
     *
     * Note: Uses club-summary for player list + trophies instead of player index
     * to avoid duplicating trophy data (which changes daily). club-summary is
     * already loaded on init, so this is instant in normal flow.
     */
    async render(urlFilters = []) {
        const clubSummary = await DataLoader.getClubSummary();
        if (!clubSummary) {
            console.error('Cannot render Player Stats: club summary not loaded');
            return;
        }

        // Parse URL: [playerTag, timeRange]
        let tagFromURL = urlFilters[0];
        let timeRangeFromURL = urlFilters[1] ? (urlFilters[1] === 'all' ? null : parseInt(urlFilters[1])) : undefined;

        // Validate player tag from URL
        if (tagFromURL && !this.isValidPlayerTag(tagFromURL, clubSummary)) {
            console.warn(`Invalid player tag in URL: ${tagFromURL}`);
            localStorage.removeItem('playerStats.selectedTag');
            this.selectedPlayerTag = null;

            // Render empty state
            this.renderPlayerSelector(clubSummary, null);
            const content = document.querySelector('.player-stats-content');
            if (content) {
                content.innerHTML = '<p style="text-align: center; color: var(--text-secondary); margin-top: 40px;">Select a player to view detailed stats</p>';
            }

            // Clean URL without triggering router (use replaceState to avoid loop)
            window.history.replaceState(null, '', '#player');
            return;
        }

        // If no valid URL tag, try localStorage
        if (!tagFromURL) {
            tagFromURL = localStorage.getItem('playerStats.selectedTag');
            // Validate localStorage tag too
            if (tagFromURL && !this.isValidPlayerTag(tagFromURL, clubSummary)) {
                console.warn(`Invalid player tag in localStorage: ${tagFromURL}`);
                localStorage.removeItem('playerStats.selectedTag');
                tagFromURL = null;
                this.selectedPlayerTag = null;
            }
        }

        // Validate time range from URL
        if (timeRangeFromURL !== undefined && !this.isValidTimeRange(timeRangeFromURL)) {
            console.warn(`Invalid time range in URL: ${timeRangeFromURL}`);
            localStorage.removeItem('playerStats.timeRange');
            timeRangeFromURL = undefined; // Fall through to default

            // Clean URL to remove invalid time range
            if (tagFromURL) {
                window.history.replaceState(null, '', `#player/${tagFromURL}`);
            }
        }

        // If no valid URL time range, try localStorage (default 30 days)
        if (timeRangeFromURL === undefined) {
            const stored = localStorage.getItem('playerStats.timeRange');
            if (stored && this.isValidTimeRange(stored)) {
                this.currentTimelineRange = stored === 'all' ? null : parseInt(stored);
            } else {
                if (stored) {
                    console.warn(`Invalid time range in localStorage: ${stored}`);
                    localStorage.removeItem('playerStats.timeRange');
                }
                this.currentTimelineRange = 30; // Default
            }
        } else {
            this.currentTimelineRange = timeRangeFromURL;
        }

        // Render player selector
        this.renderPlayerSelector(clubSummary, tagFromURL);

        // If player selected, load their stats
        if (this.selectedPlayerTag) {
            await this.loadPlayerStats(this.selectedPlayerTag);
        } else {
            // Show empty state when no player selected
            const content = document.querySelector('.player-stats-content');
            if (content) {
                content.innerHTML = '<p style="text-align: center; color: var(--text-secondary); margin-top: 40px;">Select a player to view detailed stats</p>';
            }
        }
    },

    /**
     * Render player selector buttons
     */
    renderPlayerSelector(clubSummary, selectedTag) {
        const selector = document.querySelector('.player-selector');
        if (!selector) return;

        // Get trophy leaderboard (sorted by trophies)
        const players = clubSummary.leaderboards.trophies.map(entry => ({
            tag: entry.tag,
            name: entry.name,
            trophies: entry.value
        }));

        // Don't auto-select if none specified
        this.selectedPlayerTag = selectedTag || null;

        // Render buttons
        selector.innerHTML = players.map(player => {
            const isActive = player.tag === selectedTag;
            const trophyCount = (player.trophies / 1000).toFixed(1) + 'k';
            const color = GameConfig.getPlayerChartColor(player.tag);
            return `
                <button
                    class="player-btn ${isActive ? 'active' : ''}"
                    data-tag="${player.tag}"
                    style="--player-color: ${color}">
                    <span class="player-name">${player.name}</span><span class="player-trophy">🏆 ${trophyCount}</span>
                </button>
            `;
        }).join('');

        // Add click handlers
        selector.querySelectorAll('.player-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tag = btn.dataset.tag;
                this.selectPlayer(tag);
            });
        });
    },

    /**
     * Handle player selection
     */
    async selectPlayer(tag) {
        // Toggle off if clicking active player
        if (this.selectedPlayerTag === tag) {
            this.selectedPlayerTag = null;

            // Clear localStorage when deselecting
            localStorage.removeItem('playerStats.selectedTag');

            window.location.hash = 'player';

            document.querySelectorAll('.player-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            const content = document.querySelector('.player-stats-content');
            if (content) {
                content.innerHTML = '<p style="text-align: center; color: var(--text-secondary); margin-top: 40px;">Select a player to view detailed stats</p>';
            }
            return;
        }

        this.selectedPlayerTag = tag;

        // Save to localStorage
        localStorage.setItem('playerStats.selectedTag', tag);

        // Update URL
        window.location.hash = `player/${tag}`;

        // Update button states
        document.querySelectorAll('.player-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tag === tag);
        });

        // Load stats
        await this.loadPlayerStats(tag);
    },

    /**
     * Load and display player stats
     */
    async loadPlayerStats(tag) {
        const content = document.querySelector('.player-stats-content');
        if (!content) return;

        content.innerHTML = '<div class="loading">Loading player stats...</div>';

        try {
            // Load player data (strip # from tag for file paths)
            const tagClean = tag.replace('#', '');
            const [statsData, clubSummary, brawlersData] = await Promise.all([
                fetch(`data/aggregated/players/${tagClean}/stats.json`).then(r => r.json()),
                DataLoader.getClubSummary(),
                fetch('data/aggregated/brawlers.json').then(r => r.json())
            ]);

            // Get best rank from club summary leaderboard
            const bestRankEntry = clubSummary.leaderboards.ranked_best.find(p => p.tag === tag);
            const bestRank = bestRankEntry?.value || null;

            // Load timeline data
            const timelineData = await fetch(`data/aggregated/players/${tagClean}/timeline.json`).then(r => r.json());

            // Render stats
            this.renderQuickStats(statsData, bestRank, clubSummary, tag, brawlersData.items.length);
            this.renderTrophyTimeline(timelineData, tag);
        } catch (error) {
            console.error('Failed to load player stats:', error);
            content.innerHTML = '<div class="error">Failed to load player stats</div>';
        }
    },

    /**
     * Render quick stats cards
     */
    renderQuickStats(statsData, bestRank, clubSummary, tag, totalBrawlers) {
        const content = document.querySelector('.player-stats-content');
        if (!content) return;

        const stats = statsData.quick_stats;
        const totalWins = stats.wins_3v3 + stats.wins_solo + stats.wins_duo;

        // Get player name and color
        const playerEntry = clubSummary.leaderboards.trophies.find(p => p.tag === tag);
        const playerName = playerEntry?.name || tag;
        const playerColor = GameConfig.getPlayerChartColor(tag);

        content.innerHTML = `
            <div style="text-align: center; margin-bottom: 40px; font-size: 2.5rem; font-weight: 700; line-height: 1;">
                <span style="color: ${playerColor}">${playerName}</span>
                <span style="color: var(--text-muted); font-size: 1.2rem; font-weight: 500; margin-left: 12px; vertical-align: middle;">(${tag})</span>
            </div>

            <div class="stats-row">
                <div class="stat-card accent-yellow-alt">
                    <div class="stat-label">Trophies</div>
                    <div class="stat-value">${GameConfig.formatTrophyColored(stats.trophies)}</div>
                    <div class="stat-subtext">Best: ${GameConfig.formatTrophyColored(stats.highest_trophies)}</div>
                </div>

                <div class="stat-card accent-purple-alt">
                    <div class="stat-label">Best Rank</div>
                    <div class="stat-value">${GameConfig.formatRankColored(bestRank)}</div>
                    <div class="stat-subtext">Highest All-Time</div>
                </div>

                <div class="stat-card accent-cyan-alt">
                    <div class="stat-label">Total Wins</div>
                    <div class="stat-value">${totalWins.toLocaleString()}</div>
                    <div class="stat-subtext">3v3 + Solo + Duo</div>
                </div>

                <div class="stat-card accent-pink-alt">
                    <div class="stat-label">Brawlers</div>
                    <div class="stat-value">${stats.brawlers_owned}/${totalBrawlers}</div>
                    <div class="stat-subtext">${((stats.brawlers_owned / totalBrawlers) * 100).toFixed(0)}% collected</div>
                </div>
            </div>
        `;
    },

    /**
     * Render trophy timeline chart
     */
    renderTrophyTimeline(timelineData, tag) {
        const content = document.querySelector('.player-stats-content');
        if (!content) return;

        const playerColor = GameConfig.getPlayerChartColor(tag);

        // Calculate trophy gain for current range
        const gainStats = this.calculateTrophyGain(timelineData.trophy_progression);

        // Create card container
        const cardHTML = `
            <div class="card" style="margin-top: 32px;">
                <h2 style="text-align: center; margin-bottom: 20px;">Trophy Progression</h2>

                <!-- Trophy stat centered, selectors snapped to 1/4 and 3/4 points -->
                <div style="position: relative; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; min-height: 50px;">
                    <div class="time-range-controls" style="position: absolute; left: 25%; transform: translateX(-50%);">
                        <button class="time-range-btn ${this.currentTimelineRange === 7 ? 'active' : ''}" data-days="7">7 Days</button>
                        <button class="time-range-btn ${this.currentTimelineRange === 30 ? 'active' : ''}" data-days="30">30 Days</button>
                        <button class="time-range-btn ${this.currentTimelineRange === 90 ? 'active' : ''}" data-days="90">90 Days</button>
                        <button class="time-range-btn ${this.currentTimelineRange === null ? 'active' : ''}" data-days="all">All Time</button>
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
        this.renderTimelineChart(chartContainer, timelineData, playerColor);

        // Setup time range button handlers
        content.querySelectorAll('.time-range-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;

                const days = btn.dataset.days === 'all' ? null : parseInt(btn.dataset.days);
                this.currentTimelineRange = days;

                // Save to localStorage
                localStorage.setItem('playerStats.timeRange', btn.dataset.days);

                // Update URL without triggering router
                const rangeStr = days === null ? 'all' : days.toString();
                window.history.replaceState(null, '', `#player/${this.selectedPlayerTag}/${rangeStr}`);

                // Update button states
                content.querySelectorAll('.time-range-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Re-render chart
                this.renderTimelineChart(chartContainer, timelineData, playerColor);

                // Update gain stat
                const gainStats = this.calculateTrophyGain(timelineData.trophy_progression);
                const gainValueEl = content.querySelector('.gain-value');
                if (gainValueEl) {
                    gainValueEl.style.color = gainStats.change >= 0 ? 'var(--accent-green)' : 'var(--accent-pink)';
                    gainValueEl.textContent = `${gainStats.change >= 0 ? '+' : ''}${gainStats.change.toLocaleString()} 🏆 (${gainStats.percent >= 0 ? '+' : ''}${gainStats.percent}%)`;
                }
            });
        });
    },

    /**
     * Calculate trophy gain/loss for current time range
     */
    calculateTrophyGain(progression) {
        let filteredData = progression;
        if (this.currentTimelineRange !== null) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.currentTimelineRange);
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
     * Render the actual chart
     */
    renderTimelineChart(container, timelineData, playerColor) {
        if (this.currentChart) {
            this.currentChart.destroy();
        }

        // Filter data by time range
        let filteredData = timelineData.trophy_progression;
        if (this.currentTimelineRange !== null) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.currentTimelineRange);
            filteredData = filteredData.filter(point => new Date(point.date) >= cutoffDate);
        }

        const labels = filteredData.map(p => p.date);
        const data = filteredData.map(p => p.trophies);

        const canvas = document.createElement('canvas');
        container.innerHTML = '';
        container.appendChild(canvas);

        this.currentChart = new Chart(canvas, {
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
