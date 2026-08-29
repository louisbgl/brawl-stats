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

        // TODO: Load player data from data/aggregated/players/{TAG}/stats.json
        // For now, WIP banner
        const playerIndex = DataLoader.getPlayerIndex();
        const playerName = playerIndex[tag]?.name || tag;

        content.innerHTML = `
            <div class="wip-banner">
                🚧 Work in Progress - Player stats for ${playerName} coming soon
            </div>
        `;
    }
};
