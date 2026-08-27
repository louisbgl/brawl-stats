/**
 * BattlesManager - Renders the Battles tab (v2)
 * Displays battle feed with segment loading and filters
 *
 * Dependencies: common.js (GameConfig)
 */

const BattlesManager = {
    battles: [],
    filteredBattles: [],
    currentFilters: {
        player: 'all',
        mode: 'all',
        result: 'all', // 'all', 'win', 'loss', 'draw'
        type: 'all' // 'all', 'ranked', 'soloRanked', 'friendly', 'challenge'
    },
    segmentsLoaded: [],
    warnedModes: new Set(), // Track warned modes to only warn once

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
                result: 'all',
                type: 'all'
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
                // Check if expanded view implemented for this battle
                BattleDetailRenderer.checkImplementation(battle);
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
                const mode = battle.mode || 'unknown';
                return mode.toLowerCase() === this.currentFilters.mode.toLowerCase();
            });
        }

        // Filter by result (check tracked players only)
        if (this.currentFilters.result !== 'all') {
            filtered = filtered.filter(battle => {
                const trackedPlayers = (battle.players || []).filter(p => p.trophyChange !== null);
                if (trackedPlayers.length === 0) return false;

                // Use first tracked player's result
                const result = trackedPlayers[0].result;
                if (this.currentFilters.result === 'win') return result === 'victory';
                if (this.currentFilters.result === 'loss') return result === 'defeat';
                if (this.currentFilters.result === 'draw') return result === 'draw';
                return false;
            });
        }

        // Filter by game type
        if (this.currentFilters.type !== 'all') {
            filtered = filtered.filter(battle => {
                const type = battle.type || '';
                return type === this.currentFilters.type;
            });
        }

        this.filteredBattles = filtered;
    },

    battleIncludesPlayer(battle, playerTag) {
        const players = battle.players || [];
        return players.some(p => p.tag === playerTag && p.trophyChange !== null);
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
            const mode = battle.mode;
            if (mode) modes.add(mode);
        });
        const modeOptions = Array.from(modes).sort().map(mode =>
            `<option value="${mode}" ${this.currentFilters.mode === mode ? 'selected' : ''}>${GameConfig.getModeName(mode)}</option>`
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
                        <label for="battleTypeFilter">Game Type</label>
                        <select id="battleTypeFilter" class="filter-select">
                            <option value="all" ${this.currentFilters.type === 'all' ? 'selected' : ''}>All Types</option>
                            <option value="ranked" ${this.currentFilters.type === 'ranked' ? 'selected' : ''}>Ladder</option>
                            <option value="soloRanked" ${this.currentFilters.type === 'soloRanked' ? 'selected' : ''}>Ranked</option>
                            <option value="friendly" ${this.currentFilters.type === 'friendly' ? 'selected' : ''}>Friendly</option>
                            <option value="challenge" ${this.currentFilters.type === 'challenge' ? 'selected' : ''}>Challenge</option>
                            <option value="championshipChallenge" ${this.currentFilters.type === 'championshipChallenge' ? 'selected' : ''}>Championship</option>
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
        const loadMoreHTML = this.generateLoadMoreHTML();

        if (this.filteredBattles.length === 0) {
            return `
                <div class="battle-feed">
                    <h3>Battle Feed</h3>
                    <div class="no-data">No battles found with current filters</div>
                    ${loadMoreHTML}
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
                <button id="loadAllBattles" class="load-more-btn load-all-btn">Load All</button>
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
        const mode = battle.mode || 'Unknown';
        const players = battle.players || [];
        const trackedPlayers = players.filter(p => p.trophyChange !== null);
        const mapName = battle.map || '';
        const battleType = battle.type || '';
        const timeAgo = this.getTimeAgo(battle.battleTime);
        const duration = battle.duration;

        // Determine result class from first tracked player
        let resultClass = 'battle-draw';
        if (trackedPlayers.length > 0) {
            const result = trackedPlayers[0].result;
            if (result === 'victory') {
                resultClass = 'battle-win';
            } else if (result === 'defeat') {
                resultClass = 'battle-loss';
            }
        }

        const isLadder = GameConfig.isLadderBattle(battleType);
        const typeBadge = GameConfig.getBattleTypeBadge(battleType);

        // Build player-brawler pairs for tracked players
        const playerPairs = trackedPlayers.map(p => {
            let rightContent = '';

            if (isLadder) {
                // Show trophy change for ladder battles
                const trophyText = p.trophyChange > 0 ? `+${p.trophyChange}` : `${p.trophyChange}`;
                const trophyClass = p.trophyChange > 0 ? 'positive' : 'negative';
                rightContent = `<span class="battle-trophy ${trophyClass}">${trophyText}</span>`;
            }

            return `
                <div class="battle-player-pair">
                    <span class="player-name">${p.name}</span>
                    <span class="player-brawler">${p.brawler}</span>
                    ${rightContent}
                </div>
            `;
        }).join('');

        // Badge for non-ladder - vertically centered next to player area
        const badgeHTML = !isLadder && typeBadge ? (() => {
            const badgeClass = battleType === 'soloRanked' ? 'badge-ranked' :
                               battleType === 'friendly' ? 'badge-friendly' : 'badge-challenge';
            return `<span class="battle-type-badge ${badgeClass}">${typeBadge}</span>`;
        })() : '';

        // Format duration
        const durationText = GameConfig.formatDuration(duration);
        const durationHTML = durationText ? `<span class="battle-duration">${durationText}</span>` : '';

        return `
            <div class="battle-card-compact ${resultClass}" data-battle-id="${idx}">
                <div class="battle-players-wrapper">
                    <div class="battle-players-left">
                        ${playerPairs}
                    </div>
                    ${badgeHTML}
                </div>
                <div class="battle-info-center">
                    <span class="mode-name">${GameConfig.getModeName(mode)}</span>
                    ${durationHTML}
                    <span class="map-name">${mapName}</span>
                </div>
                <div class="battle-meta-right">
                    <span class="time-ago">${timeAgo}</span>
                    <span class="expand-icon">▼</span>
                </div>
            </div>
        `;
    },

    getTimeAgo(battleTime) {
        // Parse battleTime: 20260825T125953.000Z
        const year = parseInt(battleTime.substring(0, 4));
        const month = parseInt(battleTime.substring(4, 6)) - 1;
        const day = parseInt(battleTime.substring(6, 8));
        const hour = parseInt(battleTime.substring(9, 11));
        const minute = parseInt(battleTime.substring(11, 13));
        const second = parseInt(battleTime.substring(13, 15));

        const battleDate = new Date(year, month, day, hour, minute, second);
        const now = new Date();
        const diffMs = now - battleDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    },

    generateBattleDetails(battle) {
        return BattleDetailRenderer.render(battle, this.warnedModes);
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

    async loadAllBattles() {
        const segmentOrder = ['recent', 'week-2', 'week-3', 'week-4', 'older'];

        // Load all remaining segments
        for (const segment of segmentOrder) {
            if (!this.segmentsLoaded.includes(segment)) {
                await this.loadSegment(segment);
            }
        }

        this.loadBattlesFromSegments();
        this.applyFilters();
        this.renderHTML();
        this.setupEventHandlers();
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
        const typeFilter = document.getElementById('battleTypeFilter');

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

        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                this.currentFilters.type = e.target.value;
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

        // Load all handler
        const loadAllBtn = document.getElementById('loadAllBattles');
        if (loadAllBtn) {
            loadAllBtn.addEventListener('click', () => {
                this.loadAllBattles();
            });
        }

        // Battle card click handlers
        const battleCards = document.querySelectorAll('.battle-card-compact');
        battleCards.forEach(card => {
            card.addEventListener('click', () => {
                const battleId = card.dataset.battleId;
                this.toggleBattleExpanded(battleId, card);
            });
        });
    },

    toggleBattleExpanded(battleId, cardElement) {
        const battle = this.filteredBattles[battleId];
        if (!battle) return;

        // Check if already expanded
        const existingDetails = cardElement.nextElementSibling;
        if (existingDetails && existingDetails.classList.contains('battle-details')) {
            existingDetails.remove();
            return;
        }

        // Generate and insert details
        const detailsHTML = this.generateBattleDetails(battle);
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'battle-details';
        detailsDiv.innerHTML = detailsHTML;
        cardElement.after(detailsDiv);
    }
};
