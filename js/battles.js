// Battles module - battle feed with week-based pagination

const BattlesManager = {
    battles: [],
    filteredBattles: [],
    currentFilters: {
        player: 'all',
        mode: 'all',
        result: 'all' // 'all', 'win', 'loss', 'draw'
    },
    currentWeekOffset: 0, // 0 = current week, 1 = last week, etc.

    init() {
        this.loadBattles();
        this.applyFilters();
        this.render();
    },

    loadBattles() {
        // Get all battles from battlelog data
        const allBattles = [];
        const players = DataManager.getAllPlayers();

        players.forEach(player => {
            const playerBattles = BattlelogDataManager.getBattlesForPlayer(player.tag);
            playerBattles.forEach(battle => {
                allBattles.push({
                    player: player,
                    battle: battle
                });
            });
        });

        // Sort by date descending (newest first)
        allBattles.sort((a, b) => new Date(b.battle.battleTime) - new Date(a.battle.battleTime));

        this.battles = allBattles;
    },

    applyFilters() {
        let filtered = [...this.battles];

        // Filter by player
        if (this.currentFilters.player !== 'all') {
            filtered = filtered.filter(b => b.player.tag === this.currentFilters.player);
        }

        // Filter by mode
        if (this.currentFilters.mode !== 'all') {
            filtered = filtered.filter(b => {
                const mode = b.battle.event?.mode || b.battle.battle?.mode || 'unknown';
                return mode.toLowerCase() === this.currentFilters.mode.toLowerCase();
            });
        }

        // Filter by result
        if (this.currentFilters.result !== 'all') {
            filtered = filtered.filter(b => {
                const result = this.getBattleResult(b);
                return result === this.currentFilters.result;
            });
        }

        this.filteredBattles = filtered;
    },

    getBattleResult(battleEntry) {
        const trophyChange = battleEntry.battle.battle?.trophyChange || 0;
        if (trophyChange > 0) return 'win';
        if (trophyChange < 0) return 'loss';
        return 'draw';
    },

    getBattlesForCurrentWeek() {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (this.currentWeekOffset * 7) - now.getDay()); // Start of week (Sunday)
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        return this.filteredBattles.filter(b => {
            const battleDate = new Date(b.battle.battleTime);
            return battleDate >= weekStart && battleDate < weekEnd;
        });
    },

    getWeekLabel() {
        if (this.currentWeekOffset === 0) return 'This Week';
        if (this.currentWeekOffset === 1) return 'Last Week';
        return `${this.currentWeekOffset} Weeks Ago`;
    },

    hasMoreWeeks() {
        // Check if there are battles older than current week range
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - ((this.currentWeekOffset + 1) * 7) - now.getDay());
        weekStart.setHours(0, 0, 0, 0);

        return this.filteredBattles.some(b => new Date(b.battle.battleTime) < weekStart);
    },

    render() {
        const container = document.getElementById('battlesContainer');
        if (!container) return;

        container.innerHTML = `
            ${this.generateFiltersHTML()}
            ${this.generateFeedHTML()}
        `;

        this.setupEventHandlers();
    },

    generateFiltersHTML() {
        const players = DataManager.getAllPlayers();
        const playerOptions = players.map(p =>
            `<option value="${p.tag}" ${this.currentFilters.player === p.tag ? 'selected' : ''}>${p.name}</option>`
        ).join('');

        // Get unique modes
        const modes = new Set();
        this.battles.forEach(b => {
            const mode = b.battle.event?.mode || b.battle.battle?.mode;
            if (mode) modes.add(mode);
        });
        const modeOptions = Array.from(modes).sort().map(mode =>
            `<option value="${mode}" ${this.currentFilters.mode === mode ? 'selected' : ''}>${mode}</option>`
        ).join('');

        return `
            <div class="card">
                <h2>Battle Feed Filters</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 0.9rem;">Player</label>
                        <select id="battlePlayerFilter" style="width: 100%;">
                            <option value="all">All Players</option>
                            ${playerOptions}
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 0.9rem;">Mode</label>
                        <select id="battleModeFilter" style="width: 100%;">
                            <option value="all">All Modes</option>
                            ${modeOptions}
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 0.9rem;">Result</label>
                        <select id="battleResultFilter" style="width: 100%;">
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
        const weekBattles = this.getBattlesForCurrentWeek();

        if (weekBattles.length === 0) {
            return `
                <div class="card">
                    <h2>${this.getWeekLabel()}</h2>
                    <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        No battles found for this week
                    </div>
                    ${this.hasMoreWeeks() ? '<button id="loadPreviousWeek" class="load-more-btn">Load Previous Week</button>' : ''}
                </div>
            `;
        }

        const battlesList = weekBattles.map(b => this.generateBattleEntryHTML(b)).join('');

        return `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>${this.getWeekLabel()}</h2>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">
                        ${weekBattles.length} battle${weekBattles.length !== 1 ? 's' : ''}
                    </div>
                </div>
                <div class="battles-feed">
                    ${battlesList}
                </div>
                ${this.hasMoreWeeks() ? '<button id="loadPreviousWeek" class="load-more-btn">Load Previous Week</button>' : ''}
                ${this.currentWeekOffset > 0 ? '<button id="loadNewerWeek" class="load-more-btn" style="margin-top: 10px;">Load Newer Week</button>' : ''}
            </div>
        `;
    },

    generateBattleEntryHTML(battleEntry) {
        const { player, battle } = battleEntry;
        const result = this.getBattleResult(battleEntry);
        const trophyChange = battle.battle?.trophyChange || 0;

        // Get brawler info
        let brawlerName = 'Unknown';
        let brawlerPower = '';

        // Try to get brawler from teams (3v3)
        if (battle.battle?.teams) {
            for (const team of battle.battle.teams) {
                const playerInTeam = team.find(p => p.tag === player.tag);
                if (playerInTeam && playerInTeam.brawler) {
                    brawlerName = playerInTeam.brawler.name;
                    brawlerPower = playerInTeam.brawler.power ? ` P${playerInTeam.brawler.power}` : '';
                    break;
                }
            }
        }

        // Try solo modes
        if (brawlerName === 'Unknown' && battle.battle?.players) {
            const playerInBattle = battle.battle.players.find(p => p.tag === player.tag);
            if (playerInBattle && playerInBattle.brawler) {
                brawlerName = playerInBattle.brawler.name;
                brawlerPower = playerInBattle.brawler.power ? ` P${playerInBattle.brawler.power}` : '';
            }
        }

        // Get mode and map
        const mode = battle.event?.mode || battle.battle?.mode || 'Unknown';
        const map = battle.event?.map || 'Unknown Map';

        // Get teammates (for 3v3)
        let teammatesHTML = '';
        if (battle.battle?.teams) {
            const playerTeam = battle.battle.teams.find(team => team.some(p => p.tag === player.tag));
            if (playerTeam) {
                const teammates = playerTeam.filter(p => p.tag !== player.tag);
                if (teammates.length > 0) {
                    const teammateNames = teammates.map(t => {
                        const name = this.getPlayerName(t.tag) || 'Unknown';
                        const brawler = t.brawler?.name || '?';
                        return `${name} (${brawler})`;
                    }).join(', ');
                    teammatesHTML = `<div class="battle-teammates">Teammates: ${teammateNames}</div>`;
                }
            }
        }

        // Format time ago
        const timeAgo = this.formatTimeAgo(new Date(battle.battleTime));

        // Result display
        const resultIcon = result === 'win' ? '✅' : result === 'loss' ? '❌' : '➖';
        const resultText = result === 'win' ? 'Victory' : result === 'loss' ? 'Defeat' : 'Draw';
        const trophyText = trophyChange > 0 ? `+${trophyChange}` : trophyChange < 0 ? trophyChange : '+0';

        // Result color class
        const resultClass = result === 'win' ? 'battle-win' : result === 'loss' ? 'battle-loss' : 'battle-draw';

        return `
            <div class="battle-entry ${resultClass}">
                <div class="battle-main">
                    <span class="battle-player">${player.name}</span>
                    <span class="battle-separator">|</span>
                    <span class="battle-brawler">${brawlerName}${brawlerPower}</span>
                    <span class="battle-separator">|</span>
                    <span class="battle-mode">${mode}</span>
                    <span class="battle-separator">|</span>
                    <span class="battle-map">${map}</span>
                    <span class="battle-separator">|</span>
                    <span class="battle-result">${resultIcon} ${resultText} ${trophyText}</span>
                    <span class="battle-separator">|</span>
                    <span class="battle-time">${timeAgo}</span>
                </div>
                ${teammatesHTML}
            </div>
        `;
    },

    getPlayerName(tag) {
        const players = DataManager.getAllPlayers();
        const player = players.find(p => p.tag === tag);
        return player ? player.name : null;
    },

    formatTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'just now';
    },

    setupEventHandlers() {
        // Filter handlers
        const playerFilter = document.getElementById('battlePlayerFilter');
        const modeFilter = document.getElementById('battleModeFilter');
        const resultFilter = document.getElementById('battleResultFilter');

        if (playerFilter) {
            playerFilter.addEventListener('change', (e) => {
                this.currentFilters.player = e.target.value;
                this.currentWeekOffset = 0; // Reset to current week
                this.applyFilters();
                this.render();
            });
        }

        if (modeFilter) {
            modeFilter.addEventListener('change', (e) => {
                this.currentFilters.mode = e.target.value;
                this.currentWeekOffset = 0; // Reset to current week
                this.applyFilters();
                this.render();
            });
        }

        if (resultFilter) {
            resultFilter.addEventListener('change', (e) => {
                this.currentFilters.result = e.target.value;
                this.currentWeekOffset = 0; // Reset to current week
                this.applyFilters();
                this.render();
            });
        }

        // Pagination handlers
        const loadPreviousBtn = document.getElementById('loadPreviousWeek');
        const loadNewerBtn = document.getElementById('loadNewerWeek');

        if (loadPreviousBtn) {
            loadPreviousBtn.addEventListener('click', () => {
                this.currentWeekOffset++;
                this.render();
            });
        }

        if (loadNewerBtn) {
            loadNewerBtn.addEventListener('click', () => {
                this.currentWeekOffset--;
                this.render();
            });
        }
    }
};
