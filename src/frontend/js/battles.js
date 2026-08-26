/**
 * BattlesManager - Renders the Battles tab (v2)
 * Displays battle feed with segment loading and filters
 */

const BattlesManager = {
    battles: [],
    filteredBattles: [],
    currentFilters: {
        player: 'all',
        mode: 'all',
        result: 'all' // 'all', 'win', 'loss', 'draw'
    },
    segmentsLoaded: [],

    async render(urlFilters = []) {
        // Parse URL filters: [player, mode, result]
        if (urlFilters.length > 0) {
            this.currentFilters.player = urlFilters[0] || 'all';
            this.currentFilters.mode = urlFilters[1] || 'all';
            this.currentFilters.result = urlFilters[2] || 'all';
        } else {
            // Reset to defaults
            this.currentFilters = {
                player: 'all',
                mode: 'all',
                result: 'all'
            };
        }

        // Reset to recent segment only
        this.segmentsLoaded = [];

        // Load recent battles initially
        await this.loadSegment('recent');
        this.loadBattlesFromSegments();
        this.applyFilters();
        this.renderHTML();
        this.setupEventHandlers();
    },

    async loadSegment(segment) {
        if (this.segmentsLoaded.includes(segment)) return;

        const battles = await DataLoader.loadBattleSegment(segment);
        if (battles && battles.length > 0) {
            this.segmentsLoaded.push(segment);
        }
    },

    loadBattlesFromSegments() {
        const allBattles = [];

        this.segmentsLoaded.forEach(segment => {
            const segmentBattles = DataLoader.cache.battles[segment] || [];
            segmentBattles.forEach(battle => {
                allBattles.push(battle);
            });
        });

        // Sort by battleTime descending (newest first)
        allBattles.sort((a, b) => {
            const dateA = new Date(a.battleTime);
            const dateB = new Date(b.battleTime);
            return dateB - dateA;
        });

        this.battles = allBattles;
    },

    applyFilters() {
        let filtered = [...this.battles];

        // Filter by player (check teams for player tag)
        if (this.currentFilters.player !== 'all') {
            filtered = filtered.filter(battle => {
                return this.battleIncludesPlayer(battle, this.currentFilters.player);
            });
        }

        // Filter by mode
        if (this.currentFilters.mode !== 'all') {
            filtered = filtered.filter(battle => {
                const mode = battle.event?.mode || battle.battle?.mode || 'unknown';
                return mode.toLowerCase() === this.currentFilters.mode.toLowerCase();
            });
        }

        // Filter by result
        if (this.currentFilters.result !== 'all') {
            filtered = filtered.filter(battle => {
                if (!battle.battle) return false;
                const result = battle.battle.result;
                if (this.currentFilters.result === 'win') return result === 'victory';
                if (this.currentFilters.result === 'loss') return result === 'defeat';
                if (this.currentFilters.result === 'draw') return result === 'draw';
                return false;
            });
        }

        this.filteredBattles = filtered;
    },

    battleIncludesPlayer(battle, playerTag) {
        if (!battle.battle) return false;

        // Check teams array
        const teams = battle.battle.teams || [];
        for (const team of teams) {
            if (team.some(p => p.tag === playerTag)) {
                return true;
            }
        }

        // Check players array (for modes without teams)
        const players = battle.battle.players || [];
        return players.some(p => p.tag === playerTag);
    },

    renderHTML() {
        const container = document.getElementById('battlesContainer');
        if (!container) return;

        container.innerHTML = `
            ${this.generateFiltersHTML()}
            ${this.generateFeedHTML()}
        `;
    },

    generateFiltersHTML() {
        const playerIndex = DataLoader.getPlayerIndex();
        const playerOptions = Object.entries(playerIndex || {}).map(([tag, info]) =>
            `<option value="${tag}" ${this.currentFilters.player === tag ? 'selected' : ''}>${info.name}</option>`
        ).join('');

        // Get unique modes
        const modes = new Set();
        this.battles.forEach(battle => {
            const mode = battle.event?.mode || battle.battle?.mode;
            if (mode) modes.add(mode);
        });
        const modeOptions = Array.from(modes).sort().map(mode =>
            `<option value="${mode}" ${this.currentFilters.mode === mode ? 'selected' : ''}>${this.getModeName(mode)}</option>`
        ).join('');

        return `
            <div class="filters-section">
                <h3>Filters</h3>
                <div class="filters-grid">
                    <div class="filter-group">
                        <label for="battlePlayerFilter">Player</label>
                        <select id="battlePlayerFilter" class="filter-select">
                            <option value="all">All Players</option>
                            ${playerOptions}
                        </select>
                    </div>

                    <div class="filter-group">
                        <label for="battleModeFilter">Mode</label>
                        <select id="battleModeFilter" class="filter-select">
                            <option value="all">All Modes</option>
                            ${modeOptions}
                        </select>
                    </div>

                    <div class="filter-group">
                        <label for="battleResultFilter">Result</label>
                        <select id="battleResultFilter" class="filter-select">
                            <option value="all" ${this.currentFilters.result === 'all' ? 'selected' : ''}>All Results</option>
                            <option value="win" ${this.currentFilters.result === 'win' ? 'selected' : ''}>Wins Only</option>
                            <option value="loss" ${this.currentFilters.result === 'loss' ? 'selected' : ''}>Losses Only</option>
                            <option value="draw" ${this.currentFilters.result === 'draw' ? 'selected' : ''}>Draws Only</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    },

    generateFeedHTML() {
        if (this.filteredBattles.length === 0) {
            return `
                <div class="battle-feed">
                    <h3>Battle Feed</h3>
                    <div class="no-data">No battles found with current filters</div>
                </div>
            `;
        }

        // Group by date
        const grouped = this.groupByDate(this.filteredBattles);

        const feedHTML = Object.entries(grouped).map(([date, battles]) => `
            <div class="date-group">
                <div class="date-header">${this.formatDateHeader(date)}</div>
                <div class="battles-list">
                    ${battles.map((battle, idx) => this.generateBattleCard(battle, idx)).join('')}
                </div>
            </div>
        `).join('');

        const loadMoreHTML = this.generateLoadMoreHTML();

        return `
            <div class="battle-feed">
                <h3>Battle Feed (${this.filteredBattles.length} battles)</h3>
                ${feedHTML}
                ${loadMoreHTML}
            </div>
        `;
    },

    generateLoadMoreHTML() {
        const segmentOrder = ['recent', 'week-2', 'week-3', 'week-4', 'older'];
        const lastLoaded = this.segmentsLoaded[this.segmentsLoaded.length - 1];
        const lastIndex = segmentOrder.indexOf(lastLoaded);

        if (lastIndex === -1 || lastIndex >= segmentOrder.length - 1) {
            return ''; // All segments loaded
        }

        return `
            <div class="load-more">
                <button id="loadMoreBattles" class="load-more-btn">Load Older Battles</button>
            </div>
        `;
    },

    groupByDate(battles) {
        const grouped = {};
        battles.forEach(battle => {
            // Parse battleTime format: 20260825T125953.000Z
            const bt = battle.battleTime;
            const year = bt.substring(0, 4);
            const month = bt.substring(4, 6);
            const day = bt.substring(6, 8);
            const dateStr = `${year}-${month}-${day}`;

            if (!grouped[dateStr]) {
                grouped[dateStr] = [];
            }
            grouped[dateStr].push(battle);
        });
        return grouped;
    },

    formatDateHeader(dateStr) {
        const date = new Date(dateStr);
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    },

    generateBattleCard(battle, idx) {
        const mode = battle.event?.mode || battle.battle?.mode || 'Unknown';
        const map = battle.event?.map || 'Unknown Map';
        const result = battle.battle?.result || 'unknown';
        const trophyChange = battle.battle?.trophyChange;
        const duration = battle.battle?.duration;

        // Parse battleTime: 20260825T125953.000Z
        const bt = battle.battleTime;
        const hour = bt.substring(9, 11);
        const minute = bt.substring(11, 13);
        const timeStr = `${hour}:${minute}`;

        const resultClass = result === 'victory' ? 'battle-win' : result === 'defeat' ? 'battle-loss' : 'battle-draw';
        const resultIcon = result === 'victory' ? '✅' : result === 'defeat' ? '❌' : '➖';
        const trophyText = trophyChange !== undefined ? (trophyChange > 0 ? `+${trophyChange}` : `${trophyChange}`) : '';

        return `
            <div class="battle-card ${resultClass}">
                <div class="battle-header">
                    <div class="battle-mode">
                        <span class="battle-mode-name">${this.getModeName(mode)}</span>
                        <span class="battle-map">${map}</span>
                    </div>
                    <div class="battle-meta">
                        <span class="battle-time">${timeStr}</span>
                        <span class="battle-result">${resultIcon}</span>
                        ${trophyText ? `<span class="battle-trophy ${trophyChange > 0 ? 'positive' : 'negative'}">${trophyText}🏆</span>` : ''}
                    </div>
                </div>
                ${this.generateBattleDetails(battle)}
            </div>
        `;
    },

    generateBattleDetails(battle) {
        if (!battle.battle) return '';

        const teams = battle.battle.teams || [];
        const players = battle.battle.players || [];

        // Team-based modes
        if (teams.length > 0) {
            return `
                <div class="battle-teams">
                    ${teams.map((team, idx) => `
                        <div class="battle-team">
                            ${team.map(p => `
                                <div class="battle-player">
                                    <span class="player-name">${p.name}</span>
                                    <span class="player-brawler">${p.brawler?.name || '?'} P${p.brawler?.power || '?'}</span>
                                </div>
                            `).join('')}
                        </div>
                    `).join('<div class="team-separator">VS</div>')}
                </div>
            `;
        }

        // Non-team modes (showdown, etc)
        if (players.length > 0) {
            return `
                <div class="battle-players">
                    ${players.map(p => `
                        <div class="battle-player">
                            <span class="player-name">${p.name}</span>
                            <span class="player-brawler">${p.brawler?.name || '?'} P${p.brawler?.power || '?'}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        return '';
    },

    getModeName(mode) {
        // Simple mode name formatting
        const modeNames = {
            'gemGrab': 'Gem Grab',
            'brawlBall': 'Brawl Ball',
            'bounty': 'Bounty',
            'heist': 'Heist',
            'hotZone': 'Hot Zone',
            'knockout': 'Knockout',
            'soloShowdown': 'Solo Showdown',
            'duoShowdown': 'Duo Showdown',
            'wipeout': 'Wipeout',
            'duels': 'Duels',
            'lastStand': 'Last Stand'
        };
        return modeNames[mode] || mode;
    },

    async loadMoreBattles() {
        const segmentOrder = ['recent', 'week-2', 'week-3', 'week-4', 'older'];
        const lastLoaded = this.segmentsLoaded[this.segmentsLoaded.length - 1];
        const lastIndex = segmentOrder.indexOf(lastLoaded);

        if (lastIndex >= 0 && lastIndex < segmentOrder.length - 1) {
            const nextSegment = segmentOrder[lastIndex + 1];
            await this.loadSegment(nextSegment);
            this.loadBattlesFromSegments();
            this.applyFilters();
            this.renderHTML();
            this.setupEventHandlers();
        }
    },

    updateURL() {
        const url = `battles/${this.currentFilters.player}/${this.currentFilters.mode}/${this.currentFilters.result}`;
        window.location.hash = url;
    },

    setupEventHandlers() {
        // Filter handlers
        const playerFilter = document.getElementById('battlePlayerFilter');
        const modeFilter = document.getElementById('battleModeFilter');
        const resultFilter = document.getElementById('battleResultFilter');

        if (playerFilter) {
            playerFilter.addEventListener('change', (e) => {
                this.currentFilters.player = e.target.value;
                this.applyFilters();
                this.updateURL();
                this.renderHTML();
                this.setupEventHandlers();
            });
        }

        if (modeFilter) {
            modeFilter.addEventListener('change', (e) => {
                this.currentFilters.mode = e.target.value;
                this.applyFilters();
                this.updateURL();
                this.renderHTML();
                this.setupEventHandlers();
            });
        }

        if (resultFilter) {
            resultFilter.addEventListener('change', (e) => {
                this.currentFilters.result = e.target.value;
                this.applyFilters();
                this.updateURL();
                this.renderHTML();
                this.setupEventHandlers();
            });
        }

        // Load more handler
        const loadMoreBtn = document.getElementById('loadMoreBattles');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadMoreBattles();
            });
        }
    }
};
