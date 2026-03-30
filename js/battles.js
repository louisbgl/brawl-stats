// Battles module - battle feed with week-based pagination

const BattlesManager = {
    battles: [],
    filteredBattles: [],
    currentFilters: {
        player: 'all',
        mode: 'all',
        result: 'all' // 'all', 'win', 'loss', 'draw'
    },
    currentDayOffset: 0, // 0 = today, 1 = yesterday, etc.
    daysToLoad: 7, // Show 7 days at a time

    async init() {
        // Ensure battlelog data is actually loaded before proceeding
        await BattlelogDataManager.ensureLoaded();

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
        allBattles.sort((a, b) => {
            const dateA = Utils.parseBattleTime(a.battle.battleTime);
            const dateB = Utils.parseBattleTime(b.battle.battleTime);
            if (!dateA || !dateB) return 0;
            return dateB - dateA;
        });

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

    applyFiltersFromURL(playerFilter, modeFilter, resultFilter) {
        // Apply filters from URL parameters
        if (playerFilter && playerFilter !== 'all') {
            this.currentFilters.player = playerFilter;
        }
        if (modeFilter && modeFilter !== 'all') {
            this.currentFilters.mode = modeFilter;
        }
        if (resultFilter && resultFilter !== 'all') {
            this.currentFilters.result = resultFilter;
        }

        this.currentDayOffset = 0;
        this.applyFilters();
        this.render();
    },

    updateURL() {
        // Update URL with current filters
        const params = [];
        if (this.currentFilters.player !== 'all') {
            params.push(this.currentFilters.player);
        } else {
            params.push('all');
        }
        if (this.currentFilters.mode !== 'all') {
            params.push(this.currentFilters.mode);
        } else {
            params.push('all');
        }
        if (this.currentFilters.result !== 'all') {
            params.push(this.currentFilters.result);
        } else {
            params.push('all');
        }

        Router.updateURL('battles', params);
    },

    getBattleResult(battleEntry) {
        const trophyChange = battleEntry.battle.battle?.trophyChange || 0;
        if (trophyChange > 0) return 'win';
        if (trophyChange < 0) return 'loss';
        return 'draw';
    },

    getBattlesGroupedByDay() {
        // Calculate date range: from (currentDayOffset) to (currentDayOffset + daysToLoad) days ago
        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(now.getDate() - this.currentDayOffset);
        endDate.setHours(23, 59, 59, 999); // End of the most recent day

        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - (this.daysToLoad - 1));
        startDate.setHours(0, 0, 0, 0); // Start of the oldest day

        // Filter battles in range and group by day
        const grouped = {};

        this.filteredBattles.forEach(b => {
            const battleDate = Utils.parseBattleTime(b.battle.battleTime);
            if (!battleDate) return;

            if (battleDate >= startDate && battleDate <= endDate) {
                // Get day string (YYYY-MM-DD in local time)
                const year = battleDate.getFullYear();
                const month = String(battleDate.getMonth() + 1).padStart(2, '0');
                const day = String(battleDate.getDate()).padStart(2, '0');
                const dayKey = `${year}-${month}-${day}`;

                if (!grouped[dayKey]) {
                    grouped[dayKey] = [];
                }
                grouped[dayKey].push(b);
            }
        });

        return grouped;
    },

    getDateRangeLabel() {
        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(now.getDate() - this.currentDayOffset);

        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - (this.daysToLoad - 1));

        if (this.currentDayOffset === 0) {
            return 'Last 7 Days';
        }

        const formatDate = (d) => {
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${month}/${day}`;
        };

        return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    },

    hasMoreDays() {
        // Check if there are battles older than current date range
        const now = new Date();
        const oldestDate = new Date(now);
        oldestDate.setDate(now.getDate() - this.currentDayOffset - this.daysToLoad);
        oldestDate.setHours(23, 59, 59, 999);

        return this.filteredBattles.some(b => {
            const battleDate = Utils.parseBattleTime(b.battle.battleTime);
            return battleDate && battleDate < oldestDate;
        });
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
        const groupedBattles = this.getBattlesGroupedByDay();
        const dayKeys = Object.keys(groupedBattles).sort().reverse(); // Newest first

        if (dayKeys.length === 0) {
            return `
                <div class="card">
                    <h2>${this.getDateRangeLabel()}</h2>
                    <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        No battles found in this date range
                    </div>
                    ${this.hasMoreDays() ? '<button id="loadOlderBattles" class="load-more-btn">Load Older Battles</button>' : ''}
                </div>
            `;
        }

        // Count total battles in this range
        const totalInRange = dayKeys.reduce((sum, day) => sum + groupedBattles[day].length, 0);

        // Generate HTML for each day
        const daysHTML = dayKeys.map(dayKey => {
            const battles = groupedBattles[dayKey];
            const battlesList = battles.map(b => this.generateBattleEntryHTML(b)).join('');
            const dayLabel = this.formatDayLabel(dayKey);

            return `
                <div class="day-group">
                    <div class="day-header">${dayLabel} <span style="color: var(--text-secondary); font-size: 0.9rem;">(${battles.length} battles)</span></div>
                    <div class="battles-feed">
                        ${battlesList}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>${this.getDateRangeLabel()}</h2>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">
                        ${totalInRange} battle${totalInRange !== 1 ? 's' : ''} (${this.filteredBattles.length} total)
                    </div>
                </div>
                ${daysHTML}
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    ${this.hasMoreDays() ? '<button id="loadOlderBattles" class="load-more-btn">Load Older (7 days)</button>' : ''}
                    ${this.currentDayOffset > 0 ? '<button id="loadNewerBattles" class="load-more-btn">Load Newer (7 days)</button>' : ''}
                </div>
            </div>
        `;
    },

    formatDayLabel(dayKey) {
        return Utils.formatDayLabel(dayKey);
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
                        // Use the name from battle data, fallback to tracked player name, then 'Unknown'
                        const name = t.name || this.getPlayerName(t.tag) || 'Unknown';
                        const brawler = t.brawler?.name || '?';
                        return `${name} (${brawler})`;
                    }).join(', ');
                    teammatesHTML = `<div class="battle-teammates">Teammates: ${teammateNames}</div>`;
                }
            }
        }

        // Format time ago
        const battleDate = Utils.parseBattleTime(battle.battleTime);
        const timeAgo = battleDate ? this.formatTimeAgo(battleDate) : 'unknown';

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
                this.currentDayOffset = 0; // Reset to today
                this.applyFilters();
                this.updateURL();
                this.render();
            });
        }

        if (modeFilter) {
            modeFilter.addEventListener('change', (e) => {
                this.currentFilters.mode = e.target.value;
                this.currentDayOffset = 0; // Reset to today
                this.applyFilters();
                this.updateURL();
                this.render();
            });
        }

        if (resultFilter) {
            resultFilter.addEventListener('change', (e) => {
                this.currentFilters.result = e.target.value;
                this.currentDayOffset = 0; // Reset to today
                this.applyFilters();
                this.updateURL();
                this.render();
            });
        }

        // Pagination handlers
        const loadOlderBtn = document.getElementById('loadOlderBattles');
        const loadNewerBtn = document.getElementById('loadNewerBattles');

        if (loadOlderBtn) {
            loadOlderBtn.addEventListener('click', () => {
                this.currentDayOffset += this.daysToLoad;
                this.render();
            });
        }

        if (loadNewerBtn) {
            loadNewerBtn.addEventListener('click', () => {
                this.currentDayOffset = Math.max(0, this.currentDayOffset - this.daysToLoad);
                this.render();
            });
        }
    }
};
