/**
 * BattleDetailRenderer - Renders expanded battle views
 * Routes to appropriate renderer based on mode category
 *
 * Dependencies: common.js (GameConfig)
 */

const BattleDetailRenderer = {
    warnedCombos: new Set(), // Track warned mode+type combos

    checkImplementation(battle) {
        const mode = battle.mode || 'unknown';
        const type = battle.type || 'unknown';
        const combo = `${mode}+${type}`;

        // No renderers implemented yet
        const hasRenderer = false;

        // Warn once per unhandled combo
        if (!hasRenderer && !this.warnedCombos.has(combo)) {
            const typeBadge = GameConfig.getBattleTypeBadge(type);
            const typeLabel = typeBadge || (GameConfig.isLadderBattle(type) ? 'Ladder' : type);
            console.warn(`Expanded view not implemented for: ${GameConfig.getModeName(mode)} (${mode}) + ${typeLabel} (${type})`);
            this.warnedCombos.add(combo);
        }
    },

    render(battle, warnedModes) {
        const mode = battle.mode || 'unknown';
        const type = battle.type || 'unknown';

        // All expanded views not implemented yet
        return this.renderUnhandled(mode, type);
    },

    renderTeamBattle(battle, mode, type) {
        const players = battle.players || [];
        const hasTeams = players.some(p => p.team !== undefined && p.team !== null);

        if (!hasTeams) {
            return this.renderUnhandled(mode, type);
        }

        // Group by team
        const teams = {};
        players.forEach(p => {
            const teamNum = p.team || 0;
            if (!teams[teamNum]) teams[teamNum] = [];
            teams[teamNum].push(p);
        });

        // Find tracked players team - prefer winning team
        let trackedTeam = null;
        for (const [teamNum, teamPlayers] of Object.entries(teams)) {
            const hasTracked = teamPlayers.some(p => p.trophyChange !== null);
            const hasWin = teamPlayers.some(p => p.result === 'victory');

            if (hasTracked && hasWin) {
                trackedTeam = teamNum;
                break;
            }
            if (hasTracked && trackedTeam === null) {
                trackedTeam = teamNum;
            }
        }

        // Order teams: tracked team first
        const teamEntries = Object.entries(teams);
        if (trackedTeam !== null) {
            teamEntries.sort((a, b) => {
                if (a[0] === trackedTeam) return -1;
                if (b[0] === trackedTeam) return 1;
                return 0;
            });
        }

        return `
            <div class="battle-teams">
                ${teamEntries.map(([teamNum, teamPlayers]) => `
                    <div class="battle-team">
                        ${teamPlayers.map(p => `
                            <div class="battle-player">
                                <span class="player-name">${p.name}</span>
                                <span class="player-brawler">${p.brawler} P${p.power}</span>
                            </div>
                        `).join('')}
                    </div>
                `).join('<div class="team-separator">VS</div>')}
            </div>
        `;
    },

    renderShowdownBattle(battle, mode, type) {
        // Not implemented yet
        return this.renderUnhandled(mode, type);
    },

    renderDuelsBattle(battle, mode, type) {
        // Not implemented yet
        return this.renderUnhandled(mode, type);
    },

    renderPvEBattle(battle, mode, type) {
        // Not implemented yet
        return this.renderUnhandled(mode, type);
    },

    renderUnhandled(mode, type) {
        return `
            <div class="battle-details-unhandled">
                <div class="unhandled-separator"></div>
                <div class="unhandled-message">
                    <strong>Mode:</strong> ${GameConfig.getModeName(mode)} (${mode})<br>
                    <strong>Type:</strong> ${type}<br>
                    <em>Expanded view not implemented yet</em>
                </div>
            </div>
        `;
    }
};
