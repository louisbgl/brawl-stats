/**
 * PlayerStatsManager - Player Stats tab
 * Player selection and detailed stats display
 *
 * Dependencies: data.js, config.js
 */

const PlayerStatsManager = {
    selectedPlayerTag: null,

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

        // Parse URL: [playerTag]
        const tagFromURL = urlFilters[0];

        // Render player selector
        this.renderPlayerSelector(clubSummary, tagFromURL);

        // If player selected, load their stats
        if (this.selectedPlayerTag) {
            await this.loadPlayerStats(this.selectedPlayerTag);
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

            // Render stats
            this.renderQuickStats(statsData, bestRank, clubSummary, tag, brawlersData.items.length);
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
    }
};
