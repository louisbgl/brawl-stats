// Battles module - battle feed with week-based pagination
// Refactored to use shared helpers from helpers.js

const BattlesManager = {
    battles: [],
    filteredBattles: [],
    currentFilters: {
        player: 'all',
        mode: 'all',
        type: 'all', // 'all', 'ranked', 'soloRanked', 'friendly', 'event'
        result: 'all' // 'all', 'win', 'loss', 'draw'
    },
    daysLoaded: 7, // Total days to show (starts at 7, increases when loading more)

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
                const mode = BattlelogHelpers.getBattleMode(b.battle);
                return mode.toLowerCase() === this.currentFilters.mode.toLowerCase();
            });
        }

        // Filter by type
        if (this.currentFilters.type !== 'all') {
            filtered = filtered.filter(b => {
                const battleType = b.battle.battle?.type;
                if (this.currentFilters.type === 'event') {
                    return battleType === null || battleType === undefined;
                }
                return battleType === this.currentFilters.type;
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

    applyFiltersFromURL(playerFilter, modeFilter, typeFilter, resultFilter) {
        // Apply filters from URL parameters
        if (playerFilter && playerFilter !== 'all') {
            this.currentFilters.player = playerFilter;
        }
        if (modeFilter && modeFilter !== 'all') {
            this.currentFilters.mode = modeFilter;
        }
        if (typeFilter && typeFilter !== 'all') {
            this.currentFilters.type = typeFilter;
        }
        if (resultFilter && resultFilter !== 'all') {
            this.currentFilters.result = resultFilter;
        }

        this.daysLoaded = 7;
        this.applyFilters();
        this.render();
    },

    updateURL() {
        // Update URL with current filters
        const params = [];
        params.push(this.currentFilters.player !== 'all' ? this.currentFilters.player : 'all');
        params.push(this.currentFilters.mode !== 'all' ? this.currentFilters.mode : 'all');
        params.push(this.currentFilters.type !== 'all' ? this.currentFilters.type : 'all');
        params.push(this.currentFilters.result !== 'all' ? this.currentFilters.result : 'all');

        Router.updateURL('battles', params);
    },

    getBattleResult(battleEntry) {
        return BattlelogHelpers.getBattleResult(battleEntry.battle);
    },

    getBattlesGroupedByDay() {
        // Show battles from today back to daysLoaded days ago
        const now = new Date();
        const endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999); // End of today

        const startDate = new Date(now);
        startDate.setDate(now.getDate() - (this.daysLoaded - 1));
        startDate.setHours(0, 0, 0, 0); // Start of the oldest day to show

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
        if (this.daysLoaded === 7) {
            return 'Last 7 Days';
        }

        if (this.daysLoaded >= 9999) {
            return 'All Battles';
        }

        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - (this.daysLoaded - 1));

        const formatDate = (d) => {
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${month}/${day}`;
        };

        return `${formatDate(startDate)} - ${formatDate(now)} (${this.daysLoaded} days)`;
    },

    hasMoreDays() {
        // Check if there are battles older than current loaded range
        const now = new Date();
        const oldestLoadedDate = new Date(now);
        oldestLoadedDate.setDate(now.getDate() - this.daysLoaded);
        oldestLoadedDate.setHours(0, 0, 0, 0);

        return this.filteredBattles.some(b => {
            const battleDate = Utils.parseBattleTime(b.battle.battleTime);
            return battleDate && battleDate < oldestLoadedDate;
        });
    },

    loadMoreDays() {
        this.daysLoaded += 7;
        this.render();
    },

    loadAllDays() {
        // Set to a very large number to show all battles
        this.daysLoaded = 9999;
        this.render();
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

        // Get unique modes using helper
        const modes = new Set();
        this.battles.forEach(b => {
            const mode = BattlelogHelpers.getBattleMode(b.battle);
            if (mode && mode !== 'Unknown') modes.add(mode);
        });
        const modeOptions = Array.from(modes).sort().map(mode =>
            `<option value="${mode}" ${this.currentFilters.mode === mode ? 'selected' : ''}>${GameConstants.getModeName(mode)}</option>`
        ).join('');

        return `
            <div class="card">
                <h2>Battle Feed Filters</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px;">
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
                        <label style="display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 0.9rem;">Type</label>
                        <select id="battleTypeFilter" style="width: 100%;">
                            <option value="all" ${this.currentFilters.type === 'all' ? 'selected' : ''}>All Types</option>
                            <option value="ranked" ${this.currentFilters.type === 'ranked' ? 'selected' : ''}>Ladder</option>
                            <option value="soloRanked" ${this.currentFilters.type === 'soloRanked' ? 'selected' : ''}>Competitive Ranked</option>
                            <option value="friendly" ${this.currentFilters.type === 'friendly' ? 'selected' : ''}>Friendly</option>
                            <option value="event" ${this.currentFilters.type === 'event' ? 'selected' : ''}>Events</option>
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
                    ${this.hasMoreDays() ? '<button id="loadOlderBattles" class="load-more-btn">Load 7 More Days</button>' : ''}
                    ${this.hasMoreDays() ? '<button id="loadAllBattles" class="load-more-btn" style="background: var(--accent-purple);">Load All</button>' : ''}
                </div>
            </div>
        `;
    },

    formatDayLabel(dayKey) {
        return Utils.formatDayLabel(dayKey);
    },

    generateBattleEntryHTML(battleEntry) {
        const { player, battle } = battleEntry;
        const battleId = `battle-${battle.battleTime}-${player.tag}`.replace(/[^a-zA-Z0-9-]/g, '');

        // Generate collapsed view (minimal, scannable)
        const collapsedHTML = this.generateCollapsedBattleHTML(battleEntry);

        // Generate expanded view (detailed, mode-specific)
        const expandedHTML = this.generateExpandedBattleHTML(battleEntry);

        const result = this.getBattleResult(battleEntry);
        const resultClass = result === 'win' ? 'battle-win' : result === 'loss' ? 'battle-loss' : 'battle-draw';

        // Add competitive ranked class for different styling
        const battleType = battle.battle?.type;
        const rankedClass = battleType === 'soloRanked' ? 'battle-competitive-ranked' : '';

        return `
            <div class="battle-card ${resultClass} ${rankedClass}" data-battle-id="${battleId}">
                <div class="battle-collapsed" onclick="BattlesManager.toggleBattle('${battleId}')">
                    ${collapsedHTML}
                </div>
                <div class="battle-expanded" id="${battleId}" style="display: none;">
                    ${expandedHTML}
                </div>
            </div>
        `;
    },

    generateCollapsedBattleHTML(battleEntry) {
        const { player, battle } = battleEntry;
        const result = this.getBattleResult(battleEntry);
        const trophyChange = BattlelogHelpers.getTrophyChange(battle, player.tag);
        const battleType = battle.battle?.type;

        // Get brawler info
        const brawlerData = BattlelogHelpers.getPlayerBrawlerFromBattle(battle, player.tag);
        let brawlerName;
        if (Array.isArray(brawlerData)) {
            brawlerName = brawlerData.map(b => b.name).join(', ');
        } else {
            brawlerName = brawlerData ? brawlerData.name : 'Unknown';
        }

        const battleMode = BattlelogHelpers.getBattleMode(battle);
        const mode = GameConstants.getModeName(battleMode);
        const map = BattlelogHelpers.getBattleMap(battle);
        const battleDate = Utils.parseBattleTime(battle.battleTime);
        const timeAgo = battleDate ? ViewHelpers.formatTimeAgo(battleDate) : 'unknown';

        // Result display
        const resultText = result === 'win' ? 'Victory' : result === 'loss' ? 'Defeat' : 'Draw';
        const trophyText = trophyChange !== 0 ? (trophyChange > 0 ? `+${trophyChange}` : trophyChange) : '';

        // Add badges
        const rankedBadge = battleType === 'soloRanked' ? '<span class="battle-ranked-badge">RANKED</span>' : '';
        const eventBadge = (GameConstants.isPvEMode(battleMode) || battleType === null || battleType === undefined) ? '<span class="battle-event-badge">EVENT</span>' : '';

        return `
            <div class="battle-collapsed-row">
                ${rankedBadge}${eventBadge}
                <span class="battle-player-name">${player.name}</span>
                <span class="battle-separator">|</span>
                <span class="battle-brawler-name">${brawlerName}</span>
                <span class="battle-separator">|</span>
                <span class="battle-mode-name">${mode}</span>
                <span class="battle-separator">|</span>
                <span class="battle-map">${map}</span>
                <span class="battle-separator">|</span>
                <span class="battle-result">${resultText}${trophyText ? ' ' : ''}<span class="battle-trophy-change ${trophyChange > 0 ? 'positive' : trophyChange < 0 ? 'negative' : ''}">${trophyText}</span></span>
                <span class="battle-separator">|</span>
                <span class="battle-time-ago">${timeAgo}</span>
                <span class="battle-expand-icon">▼</span>
            </div>
        `;
    },

    generateExpandedBattleHTML(battleEntry) {
        const { player, battle } = battleEntry;
        const mode = BattlelogHelpers.getBattleMode(battle);
        const battleType = battle.battle?.type;

        // Team modes (3v3 and 5v5) - ladder and friendly
        if ((battleType === 'ranked' || battleType === 'friendly') && GameConstants.isTeamMode(mode)) {
            return this.generateExpandedTeamLadder(battleEntry);
        }

        // Showdown modes - ladder and friendly
        if ((battleType === 'ranked' || battleType === 'friendly') && GameConstants.isShowdownMode(mode)) {
            return this.generateExpandedShowdownLadder(battleEntry);
        }

        // Competitive ranked (soloRanked) mode
        if (battleType === 'soloRanked' && GameConstants.isTeamMode(mode)) {
            return this.generateExpandedCompetitiveRanked(battleEntry);
        }

        // Duels mode
        if (GameConstants.isDuelsMode(mode)) {
            return this.generateExpandedDuels(battleEntry);
        }

        // PvE / Special events (lastStand, etc.)
        if (GameConstants.isPvEMode(mode) || battleType === null || battleType === undefined) {
            return this.generateExpandedPvE(battleEntry);
        }

        // Default: placeholder for other modes
        console.log(`TODO: Expanded view not implemented for type="${battleType}", mode="${mode}"`);
        return `
            <div class="battle-expanded-content">
                <p style="color: var(--text-secondary); font-style: italic;">Expanded view - TODO (mode: ${mode}, type: ${battleType})</p>
            </div>
        `;
    },

    generateExpandedTeamLadder(battleEntry) {
        const { player, battle } = battleEntry;
        const result = this.getBattleResult(battleEntry);
        const trophyChange = BattlelogHelpers.getTrophyChange(battle, player.tag);

        // Get battle info
        const duration = battle.battle?.duration;
        const starPlayer = battle.battle?.starPlayer;
        const teams = battle.battle?.teams || [];

        // Find player's team and opponent team
        let playerTeam = null;
        let opponentTeam = null;
        for (const team of teams) {
            const isPlayerTeam = team.some(p => p.tag === player.tag);
            if (isPlayerTeam) {
                playerTeam = team;
            } else {
                opponentTeam = team;
            }
        }

        // Generate team HTML
        const generateTeamHTML = (team, isPlayerTeam) => {
            if (!team || team.length === 0) return '<p style="color: var(--text-secondary);">Unknown</p>';

            return team.map(p => {
                const isCurrentPlayer = p.tag === player.tag;
                const isStarPlayer = starPlayer && starPlayer.tag === p.tag;
                const brawler = p.brawler;
                const playerNameClass = isCurrentPlayer ? 'player-team-you' : '';

                // Show brawler trophies if available
                const trophyInfo = brawler.trophies ? ` (${brawler.trophies}🏆)` : '';

                return `
                    <div class="expanded-team-player">
                        <span class="expanded-player-name ${playerNameClass}">
                            ${p.name}${isCurrentPlayer ? ' (You)' : ''}${isStarPlayer ? ' ⭐' : ''}
                        </span>
                        <span class="expanded-player-brawler">
                            ${brawler.name} P${brawler.power}${trophyInfo}
                        </span>
                    </div>
                `;
            }).join('');
        };

        const durationText = duration ? `${Math.floor(duration / 60)}m ${duration % 60}s` : 'Unknown';
        const trophyText = trophyChange > 0 ? `+${trophyChange}🏆` : trophyChange < 0 ? `${trophyChange}🏆` : '0🏆';

        return `
            <div class="battle-expanded-content">
                <div class="expanded-section">
                    <div class="expanded-info-line">
                        <span class="expanded-info-text">Duration: <strong>${durationText}</strong></span>
                        <span class="expanded-info-separator">•</span>
                        <span class="expanded-info-text"><strong class="${trophyChange > 0 ? 'positive' : trophyChange < 0 ? 'negative' : ''}">${trophyText}</strong></span>
                    </div>
                </div>

                <div class="expanded-section">
                    <div class="expanded-teams-grid">
                        <div class="expanded-team ${result === 'win' ? 'team-win' : result === 'loss' ? 'team-loss' : ''}">
                            <div class="expanded-team-header">Your Team ${result === 'win' ? '✅' : result === 'loss' ? '❌' : ''}</div>
                            ${generateTeamHTML(playerTeam, true)}
                        </div>
                        <div class="expanded-team ${result === 'loss' ? 'team-win' : result === 'win' ? 'team-loss' : ''}">
                            <div class="expanded-team-header">Opponent Team ${result === 'loss' ? '✅' : result === 'win' ? '❌' : ''}</div>
                            ${generateTeamHTML(opponentTeam, false)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    generateExpandedShowdownLadder(battleEntry) {
        const { player, battle } = battleEntry;
        const mode = BattlelogHelpers.getBattleMode(battle);
        const trophyChange = BattlelogHelpers.getTrophyChange(battle, player.tag);
        const rank = battle.battle?.rank || '?';
        const trophyText = trophyChange > 0 ? `+${trophyChange}🏆` : trophyChange < 0 ? `${trophyChange}🏆` : '0🏆';

        // Get all players/teams
        const isSoloShowdown = mode === 'soloShowdown';
        const players = battle.battle?.players || [];
        const teams = battle.battle?.teams || [];

        let participantsHTML = '';

        if (isSoloShowdown) {
            // Solo showdown: list all 10 players with their brawlers
            participantsHTML = players.map((p, index) => {
                const isCurrentPlayer = p.tag === player.tag;
                const brawler = p.brawler;
                const rankNum = index + 1;
                const trophyInfo = brawler.trophies ? ` (${brawler.trophies}🏆)` : '';

                return `
                    <div class="showdown-player ${isCurrentPlayer ? 'showdown-player-you' : ''}">
                        <span class="showdown-rank">#${rankNum}</span>
                        <span class="showdown-name">${p.name}${isCurrentPlayer ? ' (You)' : ''}</span>
                        <span class="showdown-brawler">${brawler.name} P${brawler.power}${trophyInfo}</span>
                    </div>
                `;
            }).join('');
        } else {
            // Duo/Trio showdown: list all teams
            participantsHTML = teams.map((team, index) => {
                const rankNum = index + 1;
                const isPlayerTeam = team.some(p => p.tag === player.tag);

                const teamPlayersHTML = team.map(p => {
                    const isCurrentPlayer = p.tag === player.tag;
                    const brawler = p.brawler;
                    const trophyInfo = brawler.trophies ? ` (${brawler.trophies}🏆)` : '';

                    return `
                        <div class="showdown-team-player">
                            <span class="showdown-name ${isCurrentPlayer ? 'player-team-you' : ''}">${p.name}${isCurrentPlayer ? ' (You)' : ''}</span>
                            <span class="showdown-brawler">${brawler.name} P${brawler.power}${trophyInfo}</span>
                        </div>
                    `;
                }).join('');

                return `
                    <div class="showdown-team ${isPlayerTeam ? 'showdown-team-you' : ''}">
                        <div class="showdown-team-header">#${rankNum}</div>
                        ${teamPlayersHTML}
                    </div>
                `;
            }).join('');
        }

        return `
            <div class="battle-expanded-content">
                <div class="expanded-section">
                    <div class="expanded-info-line">
                        <span class="expanded-info-text">Rank: <strong>#${rank}</strong></span>
                        <span class="expanded-info-separator">•</span>
                        <span class="expanded-info-text"><strong class="${trophyChange > 0 ? 'positive' : trophyChange < 0 ? 'negative' : ''}">${trophyText}</strong></span>
                    </div>
                </div>

                <div class="expanded-section">
                    <div class="showdown-participants ${isSoloShowdown ? 'showdown-solo' : 'showdown-team-mode'}">
                        ${participantsHTML}
                    </div>
                </div>
            </div>
        `;
    },

    generateExpandedCompetitiveRanked(battleEntry) {
        const { player, battle } = battleEntry;
        const result = this.getBattleResult(battleEntry);

        // Get battle info
        const duration = battle.battle?.duration;
        const starPlayer = battle.battle?.starPlayer;
        const teams = battle.battle?.teams || [];

        // Find player's team and opponent team
        let playerTeam = null;
        let opponentTeam = null;
        for (const team of teams) {
            const isPlayerTeam = team.some(p => p.tag === player.tag);
            if (isPlayerTeam) {
                playerTeam = team;
            } else {
                opponentTeam = team;
            }
        }

        // Generate team HTML (similar to 3v3 ladder but without individual trophy info)
        const generateTeamHTML = (team, isPlayerTeam) => {
            if (!team || team.length === 0) return '<p style="color: var(--text-secondary);">Unknown</p>';

            return team.map(p => {
                const isCurrentPlayer = p.tag === player.tag;
                const isStarPlayer = starPlayer && starPlayer.tag === p.tag;
                const brawler = p.brawler;
                const playerNameClass = isCurrentPlayer ? 'player-team-you' : '';

                return `
                    <div class="expanded-team-player">
                        <span class="expanded-player-name ${playerNameClass}">
                            ${p.name}${isCurrentPlayer ? ' (You)' : ''}${isStarPlayer ? ' ⭐' : ''}
                        </span>
                        <span class="expanded-player-brawler">
                            ${brawler.name} P${brawler.power}
                        </span>
                    </div>
                `;
            }).join('');
        };

        const durationText = duration ? `${Math.floor(duration / 60)}m ${duration % 60}s` : 'Unknown';
        const resultText = result === 'win' ? 'Victory' : result === 'loss' ? 'Defeat' : 'Draw';

        return `
            <div class="battle-expanded-content">
                <div class="expanded-section">
                    <div class="expanded-info-line">
                        <span class="ranked-badge">COMPETITIVE RANKED</span>
                        <span class="expanded-info-separator">•</span>
                        <span class="expanded-info-text">Duration: <strong>${durationText}</strong></span>
                    </div>
                </div>

                <div class="expanded-section">
                    <div class="expanded-teams-grid">
                        <div class="expanded-team ${result === 'win' ? 'team-win' : result === 'loss' ? 'team-loss' : ''}">
                            <div class="expanded-team-header">Your Team ${result === 'win' ? '✅' : result === 'loss' ? '❌' : ''}</div>
                            ${generateTeamHTML(playerTeam, true)}
                        </div>
                        <div class="expanded-team ${result === 'loss' ? 'team-win' : result === 'win' ? 'team-loss' : ''}">
                            <div class="expanded-team-header">Opponent Team ${result === 'loss' ? '✅' : result === 'win' ? '❌' : ''}</div>
                            ${generateTeamHTML(opponentTeam, false)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    generateExpandedDuels(battleEntry) {
        const { player, battle } = battleEntry;
        const result = this.getBattleResult(battleEntry);
        const trophyChange = BattlelogHelpers.getTrophyChange(battle, player.tag);
        const duration = battle.battle?.duration;
        const players = battle.battle?.players || [];

        // Find player and opponent
        const currentPlayer = players.find(p => p.tag === player.tag);
        const opponent = players.find(p => p.tag !== player.tag);

        const durationText = duration ? `${Math.floor(duration / 60)}m ${duration % 60}s` : 'Unknown';
        const trophyText = trophyChange > 0 ? `+${trophyChange}🏆` : trophyChange < 0 ? `${trophyChange}🏆` : '0🏆';

        // Generate brawler list for a player
        const generateBrawlersHTML = (playerData, isCurrentPlayer) => {
            if (!playerData || !playerData.brawlers) return '<p style="color: var(--text-secondary);">Unknown</p>';

            return playerData.brawlers.map(brawler => {
                const trophyChangeText = brawler.trophyChange !== undefined && brawler.trophyChange !== 0
                    ? (brawler.trophyChange > 0 ? `+${brawler.trophyChange}` : `${brawler.trophyChange}`)
                    : '';
                const trophyInfo = brawler.trophies ? ` (${brawler.trophies}🏆)` : '';

                return `
                    <div class="duels-brawler">
                        <span class="duels-brawler-name">${brawler.name} P${brawler.power}${trophyInfo}</span>
                        ${trophyChangeText ? `<span class="duels-trophy-change ${brawler.trophyChange > 0 ? 'positive' : 'negative'}">${trophyChangeText}</span>` : ''}
                    </div>
                `;
            }).join('');
        };

        return `
            <div class="battle-expanded-content">
                <div class="expanded-section">
                    <div class="expanded-info-line">
                        <span class="expanded-info-text">Duration: <strong>${durationText}</strong></span>
                        <span class="expanded-info-separator">•</span>
                        <span class="expanded-info-text">Total: <strong class="${trophyChange > 0 ? 'positive' : trophyChange < 0 ? 'negative' : ''}">${trophyText}</strong></span>
                    </div>
                </div>

                <div class="expanded-section">
                    <div class="expanded-teams-grid">
                        <div class="expanded-team ${result === 'win' ? 'team-win' : result === 'loss' ? 'team-loss' : ''}">
                            <div class="expanded-team-header">
                                ${currentPlayer ? currentPlayer.name : player.name} (You) ${result === 'win' ? '✅' : result === 'loss' ? '❌' : ''}
                            </div>
                            ${generateBrawlersHTML(currentPlayer, true)}
                        </div>
                        <div class="expanded-team ${result === 'loss' ? 'team-win' : result === 'win' ? 'team-loss' : ''}">
                            <div class="expanded-team-header">
                                ${opponent ? opponent.name : 'Opponent'} ${result === 'loss' ? '✅' : result === 'win' ? '❌' : ''}
                            </div>
                            ${generateBrawlersHTML(opponent, false)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    generateExpandedPvE(battleEntry) {
        const { player, battle } = battleEntry;
        const result = this.getBattleResult(battleEntry);
        const mode = BattlelogHelpers.getBattleMode(battle);
        const duration = battle.battle?.duration;
        const players = battle.battle?.players || [];
        const level = battle.battle?.level;

        const durationText = duration ? `${Math.floor(duration / 60)}m ${duration % 60}s` : 'Unknown';
        const resultText = result === 'win' ? 'Victory' : result === 'loss' ? 'Defeat' : 'Unknown';

        // Generate player list
        const playersHTML = players.map(p => {
            const isCurrentPlayer = p.tag === player.tag;
            const brawler = p.brawler;
            const trophyInfo = brawler.trophies ? ` (${brawler.trophies}🏆)` : '';

            return `
                <div class="pve-player ${isCurrentPlayer ? 'pve-player-you' : ''}">
                    <span class="pve-player-name">${p.name}${isCurrentPlayer ? ' (You)' : ''}</span>
                    <span class="pve-player-brawler">${brawler.name} P${brawler.power}${trophyInfo}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="battle-expanded-content">
                <div class="expanded-section">
                    <div class="expanded-info-line">
                        <span class="pve-badge">${GameConstants.getModeName(mode).toUpperCase()}</span>
                        <span class="expanded-info-separator">•</span>
                        <span class="expanded-info-text">Result: <strong class="${result === 'win' ? 'positive' : result === 'loss' ? 'negative' : ''}">${resultText}</strong></span>
                        ${duration ? `<span class="expanded-info-separator">•</span><span class="expanded-info-text">Duration: <strong>${durationText}</strong></span>` : ''}
                        ${level ? `<span class="expanded-info-separator">•</span><span class="expanded-info-text">Level: <strong>${level.name || level}</strong></span>` : ''}
                    </div>
                </div>

                <div class="expanded-section">
                    <div class="pve-players">
                        ${playersHTML}
                    </div>
                </div>
            </div>
        `;
    },

    toggleBattle(battleId) {
        const expandedDiv = document.getElementById(battleId);
        const card = expandedDiv.closest('.battle-card');
        const expandIcon = card.querySelector('.battle-expand-icon');

        if (expandedDiv.style.display === 'none') {
            expandedDiv.style.display = 'block';
            card.classList.add('expanded');
            if (expandIcon) expandIcon.textContent = '▲';
        } else {
            expandedDiv.style.display = 'none';
            card.classList.remove('expanded');
            if (expandIcon) expandIcon.textContent = '▼';
        }
    },

    getPlayerName(tag) {
        const players = DataManager.getAllPlayers();
        const player = players.find(p => p.tag === tag);
        return player ? player.name : null;
    },


    setupEventHandlers() {
        // Filter handlers
        const playerFilter = document.getElementById('battlePlayerFilter');
        const modeFilter = document.getElementById('battleModeFilter');
        const typeFilter = document.getElementById('battleTypeFilter');
        const resultFilter = document.getElementById('battleResultFilter');

        if (playerFilter) {
            playerFilter.addEventListener('change', (e) => {
                this.currentFilters.player = e.target.value;
                this.daysLoaded = 7; // Reset to 7 days
                this.applyFilters();
                this.updateURL();
                this.render();
            });
        }

        if (modeFilter) {
            modeFilter.addEventListener('change', (e) => {
                this.currentFilters.mode = e.target.value;
                this.daysLoaded = 7; // Reset to 7 days
                this.applyFilters();
                this.updateURL();
                this.render();
            });
        }

        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                this.currentFilters.type = e.target.value;
                this.daysLoaded = 7; // Reset to 7 days
                this.applyFilters();
                this.updateURL();
                this.render();
            });
        }

        if (resultFilter) {
            resultFilter.addEventListener('change', (e) => {
                this.currentFilters.result = e.target.value;
                this.daysLoaded = 7; // Reset to 7 days
                this.applyFilters();
                this.updateURL();
                this.render();
            });
        }

        // Pagination handlers
        const loadOlderBtn = document.getElementById('loadOlderBattles');
        const loadAllBtn = document.getElementById('loadAllBattles');

        if (loadOlderBtn) {
            loadOlderBtn.addEventListener('click', () => {
                this.loadMoreDays();
            });
        }

        if (loadAllBtn) {
            loadAllBtn.addEventListener('click', () => {
                this.loadAllDays();
            });
        }
    }
};
