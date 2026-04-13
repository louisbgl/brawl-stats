// Battlelog Analytics module - helper functions for analyzing battle data

const BattlelogAnalytics = {

    // ============================================================================
    // Win Rate Calculations
    // ============================================================================

    /**
     * Calculate win rate for a player
     * @param {string} tag - Player tag
     * @param {Object} options - { mode: string, days: number, minGames: number }
     * @returns {{ wins: number, losses: number, total: number, winRate: number }}
     */
    getWinRate(tag, options = {}) {
        let battles = BattlelogDataManager.getBattlesForPlayer(tag);

        // Filter by date if specified
        if (options.days) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - options.days);
            battles = battles.filter(b => {
                const battleDate = Utils.parseBattleTime(b.battleTime);
                return battleDate && battleDate >= cutoff;
            });
        }

        // Filter by mode if specified
        if (options.mode) {
            battles = battles.filter(b => b.event.mode === options.mode);
        }

        const wins = battles.filter(b => this.isWin(b)).length;
        const losses = battles.filter(b => this.isLoss(b)).length;
        const total = wins + losses;

        return {
            wins,
            losses,
            total,
            winRate: total > 0 ? (wins / total) * 100 : 0
        };
    },

    /**
     * Get club-wide average win rate
     * @returns {number} Average win rate as percentage
     */
    getClubAverageWinRate() {
        const players = DataManager.getAllPlayers();
        let totalWr = 0;
        let count = 0;

        for (const player of players) {
            const wr = this.getWinRate(player.tag);
            if (wr.total > 0) {
                totalWr += wr.winRate;
                count++;
            }
        }

        return count > 0 ? totalWr / count : 0;
    },

    // ============================================================================
    // Battle Detection Helpers
    // ============================================================================
    // NOTE: These methods now delegate to BattlelogHelpers for consistency
    //       and proper handling of new modes (duels, lastStand, etc.)

    isWin(battle, playerTag = null) {
        return BattlelogHelpers.isWin(battle, playerTag);
    },

    isLoss(battle, playerTag = null) {
        return BattlelogHelpers.isLoss(battle, playerTag);
    },

    // Battle type detection helpers
    // Note: "ranked" = Ladder/trophy system, "soloRanked" = Competitive ELO-based ranked

    isLadderMode(battle) {
        return battle.battle.type === 'ranked';
    },

    isCompetitiveRanked(battle) {
        return battle.battle.type === 'soloRanked';
    },

    isFriendlyMode(battle) {
        return battle.battle.type === 'friendly';
    },

    isRankedMode(battle) {
        // Legacy helper - returns true for both ladder AND competitive ranked
        const type = battle.battle.type || '';
        return type.toLowerCase().includes('ranked');
    },

    // ============================================================================
    // Activity Metrics
    // ============================================================================

    /**
     * Get most active player in last N days
     * @param {number} days - Number of days to look back
     * @returns {{ tag: string, name: string, battleCount: number }}
     */
    getMostActivePlayer(days = 7) {
        const players = DataManager.getAllPlayers();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        let mostActive = null;
        let maxBattles = 0;

        for (const player of players) {
            const battles = BattlelogDataManager.getBattlesForPlayer(player.tag);
            const recentBattles = battles.filter(b => {
                const battleDate = Utils.parseBattleTime(b.battleTime);
                return battleDate && battleDate >= cutoff;
            });

            if (recentBattles.length > maxBattles) {
                maxBattles = recentBattles.length;
                mostActive = {
                    tag: player.tag,
                    name: player.name,
                    battleCount: recentBattles.length
                };
            }
        }

        return mostActive;
    },

    /**
     * Get player with best win rate in last N days (min games filter)
     * @param {number} days - Number of days to look back
     * @param {number} minGames - Minimum games to qualify
     * @returns {{ tag: string, name: string, winRate: number, wins: number, losses: number }}
     */
    getBestWinRatePlayer(days = 7, minGames = 10) {
        const players = DataManager.getAllPlayers();
        let bestPlayer = null;
        let bestWr = 0;

        for (const player of players) {
            const wr = this.getWinRate(player.tag, { days });

            if (wr.total >= minGames && wr.winRate > bestWr) {
                bestWr = wr.winRate;
                bestPlayer = {
                    tag: player.tag,
                    name: player.name,
                    winRate: wr.winRate,
                    wins: wr.wins,
                    losses: wr.losses
                };
            }
        }

        return bestPlayer;
    },

    // ============================================================================
    // Star Player (MVP) Stats
    // ============================================================================

    /**
     * Get total star player awards for a player
     * @param {string} tag - Player tag
     * @returns {number}
     */
    getStarPlayerCount(tag) {
        const battles = BattlelogDataManager.getBattlesForPlayer(tag);
        return battles.filter(b => {
            const starPlayer = b.battle.starPlayer;
            return starPlayer && starPlayer.tag === tag;
        }).length;
    },

    /**
     * Get player with most star player awards
     * @returns {{ tag: string, name: string, starPlayerCount: number }}
     */
    getTopStarPlayer() {
        const players = DataManager.getAllPlayers();
        let topPlayer = null;
        let maxStars = 0;

        for (const player of players) {
            const starCount = this.getStarPlayerCount(player.tag);

            if (starCount > maxStars) {
                maxStars = starCount;
                topPlayer = {
                    tag: player.tag,
                    name: player.name,
                    starPlayerCount: starCount
                };
            }
        }

        return topPlayer;
    },

    // ============================================================================
    // Streak Tracking
    // ============================================================================

    /**
     * Get current win streak for a player
     * @param {string} tag - Player tag
     * @returns {number} Positive for win streak, negative for loss streak, 0 for no streak
     */
    getCurrentStreak(tag) {
        const battles = BattlelogDataManager.getBattlesForPlayer(tag);
        if (battles.length === 0) return 0;

        // Battles are sorted oldest → newest, so reverse to get most recent first
        const recentBattles = [...battles].reverse();

        let streak = 0;
        let lastWasWin = null;

        for (const battle of recentBattles) {
            const isWin = this.isWin(battle);
            const isLoss = this.isLoss(battle);

            if (!isWin && !isLoss) continue; // Skip draws/friendlies

            if (lastWasWin === null) {
                lastWasWin = isWin;
                streak = isWin ? 1 : -1;
            } else if (lastWasWin === isWin) {
                streak += isWin ? 1 : -1;
            } else {
                break; // Streak broken
            }
        }

        return streak;
    },

    /**
     * Get player with longest current win streak
     * @returns {{ tag: string, name: string, streak: number }}
     */
    getLongestCurrentStreak() {
        const players = DataManager.getAllPlayers();
        let bestPlayer = null;
        let longestStreak = 0;

        for (const player of players) {
            const streak = this.getCurrentStreak(player.tag);

            if (streak > longestStreak) {
                longestStreak = streak;
                bestPlayer = {
                    tag: player.tag,
                    name: player.name,
                    streak: streak
                };
            }
        }

        return bestPlayer;
    },

    // ============================================================================
    // Mode Stats
    // ============================================================================

    /**
     * Get most played mode for a player
     * @param {string} tag - Player tag
     * @returns {{ mode: string, count: number }}
     */
    getMostPlayedMode(tag) {
        const battles = BattlelogDataManager.getBattlesForPlayer(tag);
        const modeCounts = {};

        for (const battle of battles) {
            const mode = battle.event.mode;
            modeCounts[mode] = (modeCounts[mode] || 0) + 1;
        }

        let mostPlayed = null;
        let maxCount = 0;

        for (const [mode, count] of Object.entries(modeCounts)) {
            if (count > maxCount) {
                maxCount = count;
                mostPlayed = { mode, count };
            }
        }

        return mostPlayed;
    },

    /**
     * Get club's most played mode overall
     * @returns {{ mode: string, count: number, percentage: number }}
     */
    getClubMostPlayedMode() {
        const allBattles = BattlelogDataManager.getAllBattles();
        const modeCounts = {};

        for (const battle of allBattles) {
            const mode = battle.event.mode;
            modeCounts[mode] = (modeCounts[mode] || 0) + 1;
        }

        let mostPlayed = null;
        let maxCount = 0;

        for (const [mode, count] of Object.entries(modeCounts)) {
            if (count > maxCount) {
                maxCount = count;
                mostPlayed = {
                    mode,
                    count,
                    percentage: (count / allBattles.length) * 100
                };
            }
        }

        return mostPlayed;
    },

    /**
     * Get player with best overall win rate (min games filter)
     * @param {number} minGames - Minimum games to qualify
     * @returns {{ tag: string, name: string, winRate: number, wins: number, losses: number }}
     */
    getBestOverallWinRatePlayer(minGames = 20) {
        const players = DataManager.getAllPlayers();
        let bestPlayer = null;
        let bestWr = 0;

        for (const player of players) {
            const wr = this.getWinRate(player.tag);

            if (wr.total >= minGames && wr.winRate > bestWr) {
                bestWr = wr.winRate;
                bestPlayer = {
                    tag: player.tag,
                    name: player.name,
                    winRate: wr.winRate,
                    wins: wr.wins,
                    losses: wr.losses
                };
            }
        }

        return bestPlayer;
    }
};
