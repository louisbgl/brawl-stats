// Frontend Helpers - Shared utilities for the Brawl Stars tracker
// This file consolidates common patterns used across the frontend to reduce duplication

// ============================================================================
// BATTLELOG HELPERS - Battle data extraction and analysis
// ============================================================================

const BattlelogHelpers = {
    /**
     * Get the brawler a player used in a battle
     * @param {Object} battle - Battle object from API
     * @param {string} playerTag - Player tag to find
     * @returns {Object|null} - Brawler object { name, power, ... } or null
     */
    getPlayerBrawlerFromBattle(battle, playerTag) {
        // Check team modes (3v3)
        if (battle.battle?.teams) {
            for (const team of battle.battle.teams) {
                const player = team.find(p => p.tag === playerTag);
                if (player && player.brawler) {
                    return player.brawler;
                }
            }
        }

        // Check solo modes (showdown)
        if (battle.battle?.players) {
            const player = battle.battle.players.find(p => p.tag === playerTag);
            if (player && player.brawler) {
                return player.brawler;
            }
        }

        return null;
    },

    /**
     * Get teammates from a battle (excluding the player themselves)
     * @param {Object} battle - Battle object from API
     * @param {string} playerTag - Player tag to find teammates for
     * @returns {Array} - Array of teammate objects
     */
    getTeammatesFromBattle(battle, playerTag) {
        if (!battle.battle?.teams) {
            return []; // Solo mode, no teammates
        }

        // Find the team the player is on
        for (const team of battle.battle.teams) {
            const playerInTeam = team.find(p => p.tag === playerTag);
            if (playerInTeam) {
                // Return all teammates except the player
                return team.filter(p => p.tag !== playerTag);
            }
        }

        return [];
    },

    /**
     * Get the mode from a battle
     * @param {Object} battle - Battle object
     * @returns {string} - Mode name or 'Unknown'
     */
    getBattleMode(battle) {
        return battle.event?.mode || battle.battle?.mode || 'Unknown';
    },

    /**
     * Get the map from a battle
     * @param {Object} battle - Battle object
     * @returns {string} - Map name or 'Unknown Map'
     */
    getBattleMap(battle) {
        return battle.event?.map || 'Unknown Map';
    },

    /**
     * Check if a player was star player in a battle
     * @param {Object} battle - Battle object
     * @param {string} playerTag - Player tag to check
     * @returns {boolean}
     */
    isStarPlayer(battle, playerTag) {
        const starPlayer = battle.battle?.starPlayer;
        return starPlayer && starPlayer.tag === playerTag;
    },

    /**
     * Determine if a battle was a win based on trophy change
     * @param {Object} battle - Battle object
     * @returns {boolean}
     */
    isWin(battle) {
        const trophyChange = battle.battle?.trophyChange || 0;
        if (trophyChange > 0) return true;
        if (trophyChange < 0) return false;
        // For friendly battles (trophyChange = 0), check result
        return battle.battle?.result === 'victory';
    },

    /**
     * Determine if a battle was a loss based on trophy change
     * @param {Object} battle - Battle object
     * @returns {boolean}
     */
    isLoss(battle) {
        const trophyChange = battle.battle?.trophyChange || 0;
        if (trophyChange < 0) return true;
        if (trophyChange > 0) return false;
        // For friendly battles (trophyChange = 0), check result
        return battle.battle?.result === 'defeat';
    },

    /**
     * Get battle result as string
     * @param {Object} battle - Battle object
     * @returns {string} - 'win', 'loss', or 'draw'
     */
    getBattleResult(battle) {
        const trophyChange = battle.battle?.trophyChange || 0;
        if (trophyChange > 0) return 'win';
        if (trophyChange < 0) return 'loss';
        return 'draw';
    },

    /**
     * Calculate brawler battle statistics for a player
     * @param {string} playerTag - Player tag
     * @param {Array} battles - Array of battles
     * @returns {Object} - Map of brawler name -> { name, games, wins, trophyChange, mvps, winRate }
     */
    calculateBrawlerStats(playerTag, battles) {
        const brawlerStats = {};

        battles.forEach(battle => {
            const brawler = this.getPlayerBrawlerFromBattle(battle, playerTag);
            if (!brawler) return;

            const brawlerName = brawler.name;

            if (!brawlerStats[brawlerName]) {
                brawlerStats[brawlerName] = {
                    name: brawlerName,
                    games: 0,
                    wins: 0,
                    trophyChange: 0,
                    mvps: 0,
                    lastPlayed: battle.battleTime
                };
            }

            brawlerStats[brawlerName].games++;
            if (this.isWin(battle)) brawlerStats[brawlerName].wins++;
            brawlerStats[brawlerName].trophyChange += battle.battle?.trophyChange || 0;
            if (this.isStarPlayer(battle, playerTag)) brawlerStats[brawlerName].mvps++;

            // Update last played if more recent
            const currentBattleDate = Utils.parseBattleTime(battle.battleTime);
            const lastPlayedDate = Utils.parseBattleTime(brawlerStats[brawlerName].lastPlayed);
            if (currentBattleDate && lastPlayedDate && currentBattleDate > lastPlayedDate) {
                brawlerStats[brawlerName].lastPlayed = battle.battleTime;
            }
        });

        // Calculate win rates
        Object.values(brawlerStats).forEach(stats => {
            stats.winRate = stats.games > 0 ? (stats.wins / stats.games) * 100 : 0;
        });

        return brawlerStats;
    },

    /**
     * Construct trophy timeline from snapshot data and battles
     * @param {string} playerTag - Player tag
     * @param {Array} historicalData - DataManager.historicalData
     * @param {Array} battles - Battles for this player
     * @param {string|null} brawlerName - Optional: filter by brawler name
     * @returns {Object} - { dates, trophies, sources, snapshotDates, snapshotTrophies, snapshotTimestamps }
     */
    constructTrophyTimeline(playerTag, historicalData, battles, brawlerName = null) {
        const timeline = {
            dates: [],
            trophies: [],
            sources: [],
            snapshotDates: [],
            snapshotTrophies: [],
            snapshotTimestamps: []
        };

        // Store daily snapshots
        historicalData.forEach(snapshot => {
            const player = DataManager.findPlayerInSnapshot(snapshot, playerTag);
            if (player) {
                timeline.snapshotDates.push(snapshot.date);

                let trophies;
                if (brawlerName) {
                    const brawler = player.brawlers.find(b => b.name === brawlerName);
                    trophies = brawler ? brawler.trophies : 0;
                } else {
                    trophies = player.trophies;
                }

                timeline.snapshotTrophies.push(trophies);
                timeline.snapshotTimestamps.push(snapshot.timestamp);
            }
        });

        // If no battles, just return snapshots
        if (!battles || battles.length === 0) {
            timeline.dates = [...timeline.snapshotDates];
            timeline.trophies = [...timeline.snapshotTrophies];
            timeline.sources = new Array(timeline.dates.length).fill('snapshot');
            return timeline;
        }

        // Build timeline with battle granularity
        const points = [];

        // Add all snapshot points as anchors
        timeline.snapshotDates.forEach((date, i) => {
            points.push({
                date: new Date(timeline.snapshotTimestamps[i]),
                dateStr: date,
                trophies: timeline.snapshotTrophies[i],
                source: 'snapshot',
                isAnchor: true
            });
        });

        // Filter battles by brawler if specified
        let relevantBattles = [...battles];
        if (brawlerName) {
            relevantBattles = battles.filter(battle => {
                const brawler = this.getPlayerBrawlerFromBattle(battle, playerTag);
                return brawler && brawler.name === brawlerName;
            });
        }

        // Sort battles oldest to newest
        relevantBattles.sort((a, b) => {
            const dateA = Utils.parseBattleTime(a.battleTime);
            const dateB = Utils.parseBattleTime(b.battleTime);
            return dateA - dateB;
        });

        if (relevantBattles.length > 0 && timeline.snapshotTimestamps.length > 0) {
            const battlesWithTime = relevantBattles.map(b => {
                const date = Utils.parseBattleTime(b.battleTime);
                return {
                    time: date,
                    timeStr: date ? date.toISOString() : null,
                    trophyChange: b.battle?.trophyChange || 0
                };
            }).filter(b => b.time !== null);

            // Process battles between snapshots
            for (let snapshotIdx = 0; snapshotIdx < timeline.snapshotTimestamps.length; snapshotIdx++) {
                const snapshotTime = new Date(timeline.snapshotTimestamps[snapshotIdx]);
                const snapshotTrophies = timeline.snapshotTrophies[snapshotIdx];
                const nextSnapshotTime = snapshotIdx < timeline.snapshotTimestamps.length - 1
                    ? new Date(timeline.snapshotTimestamps[snapshotIdx + 1])
                    : new Date();

                const battlesInRange = battlesWithTime.filter(b =>
                    b.time > snapshotTime && b.time <= nextSnapshotTime
                );

                if (battlesInRange.length > 0) {
                    let currentTrophies = snapshotIdx < timeline.snapshotTimestamps.length - 1
                        ? timeline.snapshotTrophies[snapshotIdx + 1]
                        : snapshotTrophies;

                    if (snapshotIdx === timeline.snapshotTimestamps.length - 1) {
                        // Last snapshot: calculate forward
                        battlesInRange.forEach(battle => {
                            currentTrophies += battle.trophyChange;
                            points.push({
                                date: battle.time,
                                dateStr: battle.timeStr,
                                trophies: currentTrophies,
                                source: 'battle',
                                isAnchor: false
                            });
                        });
                    } else {
                        // Between snapshots: work backwards from next snapshot
                        const battlePoints = [];
                        for (let i = battlesInRange.length - 1; i >= 0; i--) {
                            const battle = battlesInRange[i];
                            currentTrophies -= battle.trophyChange;
                            battlePoints.unshift({
                                date: battle.time,
                                dateStr: battle.timeStr,
                                trophies: currentTrophies + battle.trophyChange,
                                source: 'battle',
                                isAnchor: false
                            });
                        }
                        points.push(...battlePoints);
                    }
                }
            }
        }

        // Sort all points chronologically
        points.sort((a, b) => a.date - b.date);

        timeline.dates = points.map(p => p.dateStr);
        timeline.trophies = points.map(p => p.trophies);
        timeline.sources = points.map(p => p.source);

        return timeline;
    }
};

// ============================================================================
// CHART HELPERS - Chart.js factory functions and configurations
// ============================================================================

const ChartHelpers = {
    /**
     * Get common configuration for line charts
     * @param {string} yLabel - Y-axis label
     * @param {Object} overrides - Optional config overrides
     * @returns {Object} - Chart.js options object
     */
    getCommonLineOptions(yLabel, overrides = {}) {
        const defaults = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: value => value.toLocaleString(),
                        color: '#9ba3af'
                    },
                    grid: {
                        color: '#3a4556'
                    },
                    title: {
                        display: true,
                        text: yLabel,
                        color: '#e8eaed'
                    }
                },
                x: {
                    ticks: {
                        color: '#9ba3af',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#e8eaed',
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    itemSort: (a, b) => b.parsed.y - a.parsed.y,
                    callbacks: {
                        label: context =>
                            `${context.dataset.label}: ${context.parsed.y.toLocaleString()}`
                    }
                }
            }
        };

        return this.deepMerge(defaults, overrides);
    },

    /**
     * Get common configuration for bar charts
     * @param {string} yLabel - Y-axis label
     * @param {Object} overrides - Optional config overrides
     * @returns {Object} - Chart.js options object
     */
    getCommonBarOptions(yLabel, overrides = {}) {
        const defaults = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: '#9ba3af',
                        callback: value => value.toLocaleString()
                    },
                    grid: {
                        color: '#3a4556'
                    },
                    title: {
                        display: true,
                        text: yLabel,
                        color: '#e8eaed'
                    }
                },
                x: {
                    ticks: {
                        color: '#9ba3af'
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    itemSort: (a, b) => b.parsed.y - a.parsed.y,
                    callbacks: {
                        label: context => `${context.parsed.y} brawler${context.parsed.y !== 1 ? 's' : ''}`
                    }
                }
            }
        };

        return this.deepMerge(defaults, overrides);
    },

    /**
     * Create animation config for bar charts with value labels on top
     * @returns {Object} - Chart.js animation config
     */
    createBarWithLabelsAnimation() {
        return {
            onComplete: function() {
                const chartInstance = this;
                const ctx = chartInstance.ctx;
                ctx.font = '12px sans-serif';
                ctx.fillStyle = '#e8eaed';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';

                this.data.datasets.forEach((dataset, i) => {
                    const meta = chartInstance.getDatasetMeta(i);
                    meta.data.forEach((bar, index) => {
                        const data = dataset.data[index];
                        if (data > 0) {
                            ctx.fillText(data, bar.x, bar.y - 5);
                        }
                    });
                });
            }
        };
    },

    /**
     * Create a line chart dataset object
     * @param {string} label - Dataset label
     * @param {Array} data - Data points
     * @param {string} color - Color hex code
     * @param {Object} options - Optional dataset options
     * @returns {Object} - Chart.js dataset
     */
    createLineDataset(label, data, color, options = {}) {
        return {
            label,
            data,
            borderColor: color,
            backgroundColor: color + '20',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
            ...options
        };
    },

    /**
     * Format battle timestamp for chart display
     * @param {Date} date - Date object
     * @returns {string} - Formatted string
     */
    formatBattleTimestamp(date) {
        if (!date || isNaN(date.getTime())) return '';

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        // Format time as HH:MM
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;

        if (dateDay.getTime() === today.getTime()) {
            return `Today ${timeStr}`;
        }

        if (dateDay.getTime() === yesterday.getTime()) {
            return `Yesterday ${timeStr}`;
        }

        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const day = date.getDate();
        return `${month} ${day} ${timeStr}`;
    },

    /**
     * Deep merge two objects (for config overrides)
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} - Merged object
     */
    deepMerge(target, source) {
        const output = { ...target };

        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        output[key] = source[key];
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    output[key] = source[key];
                }
            });
        }

        return output;
    },

    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }
};

// ============================================================================
// VIEW HELPERS - HTML generation utilities
// ============================================================================

const ViewHelpers = {
    /**
     * Create a stat box HTML element
     * @param {string} label - Stat label
     * @param {string|number} value - Stat value
     * @param {string} highlightClass - Optional CSS class (highlight-blue, highlight-green, etc.)
     * @returns {string} - HTML string
     */
    createStatBox(label, value, highlightClass = '') {
        return `
            <div class="stat-box">
                <div class="stat-label">${label}</div>
                <div class="stat-value ${highlightClass}">${value}</div>
            </div>
        `;
    },

    /**
     * Create a filter select dropdown
     * @param {string} id - Select element ID
     * @param {string} label - Label text
     * @param {Array} options - Array of { value, text, selected } objects
     * @returns {string} - HTML string
     */
    createFilterSelect(id, label, options) {
        const optionsHTML = options.map(opt =>
            `<option value="${opt.value}" ${opt.selected ? 'selected' : ''}>${opt.text}</option>`
        ).join('');

        return `
            <div>
                <label style="display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 0.9rem;">${label}</label>
                <select id="${id}" style="width: 100%;">
                    ${optionsHTML}
                </select>
            </div>
        `;
    },

    /**
     * Format time ago from a date
     * @param {Date} date - Date object
     * @returns {string} - "5m ago", "2h ago", "3d ago", etc.
     */
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

    /**
     * Format last played date string from battleTime
     * @param {string} battleTime - Battle time string (20260324T161433.000Z format)
     * @returns {string} - "Today", "Yesterday", "5 days ago", etc.
     */
    formatLastPlayed(battleTime) {
        if (!battleTime) return 'Unknown';
        const date = Utils.parseBattleTime(battleTime);
        if (!date || isNaN(date.getTime())) return 'Unknown';

        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        return `${diffDays} days ago`;
    },

    /**
     * Create badge HTML for items (gadgets, star powers, etc.)
     * @param {string|null} itemName - Item name or null for missing
     * @returns {string} - HTML string
     */
    createItemBadge(itemName) {
        if (itemName) {
            return `<span class="badge owned">${itemName}</span>`;
        }
        return '<span class="badge missing">Missing</span>';
    },

    /**
     * Format items list as badges
     * @param {Array<string|null>} items - Array of item names or nulls
     * @returns {string} - HTML string of badges
     */
    formatItemsList(items) {
        return items.map(item => this.createItemBadge(item)).join(' ');
    }
};

// ============================================================================
// CALCULATION HELPERS - Shared calculation utilities
// ============================================================================

const CalculationHelpers = {
    /**
     * Check if a brawler is maxed (P11 with all items)
     * @param {Object} brawler - Brawler object from player data
     * @returns {boolean}
     */
    isMaxedBrawler(brawler) {
        return brawler.power === 11 &&
               brawler.gadget_ids.length >= GameConstants.MAXED_CRITERIA.gadgets &&
               brawler.star_power_ids.length >= GameConstants.MAXED_CRITERIA.starPowers &&
               brawler.hyper_charge_ids.length >= GameConstants.MAXED_CRITERIA.hypercharges;
    },

    /**
     * Calculate prestige level from trophy count
     * @param {number} trophies - Trophy count
     * @returns {number} - Prestige level (0, 1, 2, etc.)
     */
    getPrestigeLevel(trophies) {
        return Math.floor(trophies / GameConstants.PRESTIGE_THRESHOLD);
    },

    /**
     * Calculate upgrade costs for a brawler or account
     * This duplicates the logic from player-stats.js for reuse
     * @param {Array} ownedBrawlers - Player's brawlers
     * @param {Array} allBrawlersRef - All brawlers from brawlers.json
     * @returns {Object} - Cost breakdown object
     */
    calculateUpgradeCosts(ownedBrawlers, allBrawlersRef) {
        let currentWorthCoins = 0;
        let currentWorthPowerPoints = 0;
        let costToMaxCoins = 0;
        let costToMaxPowerPoints = 0;
        let missingGadgets = 0;
        let missingStarPowers = 0;
        let missingHypercharges = 0;
        let belowP11 = 0;

        // Calculate for owned brawlers
        ownedBrawlers.forEach(b => {
            // Power level costs
            for (let p = 1; p <= b.power; p++) {
                currentWorthCoins += GameConstants.COIN_COSTS[p];
                currentWorthPowerPoints += GameConstants.POWER_POINT_COSTS[p];
            }
            if (b.power < 11) {
                belowP11++;
                for (let p = b.power + 1; p <= 11; p++) {
                    costToMaxCoins += GameConstants.COIN_COSTS[p];
                    costToMaxPowerPoints += GameConstants.POWER_POINT_COSTS[p];
                }
            }

            const brawlerRef = allBrawlersRef.find(br => br.name === b.name);
            if (brawlerRef) {
                // Gadgets
                const gadgetsOwned = b.gadget_ids.length;
                const gadgetsAvailable = (brawlerRef.gadgets || []).length;
                currentWorthCoins += gadgetsOwned * GameConstants.ITEM_COSTS.GADGET;
                const gadgetsMissing = Math.max(0, gadgetsAvailable - gadgetsOwned);
                missingGadgets += gadgetsMissing;
                costToMaxCoins += gadgetsMissing * GameConstants.ITEM_COSTS.GADGET;

                // Star Powers
                const spOwned = b.star_power_ids.length;
                const spAvailable = (brawlerRef.starPowers || []).length;
                currentWorthCoins += spOwned * GameConstants.ITEM_COSTS.STAR_POWER;
                const spMissing = Math.max(0, spAvailable - spOwned);
                missingStarPowers += spMissing;
                costToMaxCoins += spMissing * GameConstants.ITEM_COSTS.STAR_POWER;

                // Hypercharges
                const hcOwned = b.hyper_charge_ids.length;
                const hcAvailable = (brawlerRef.hyperCharges || []).length;
                currentWorthCoins += hcOwned * GameConstants.ITEM_COSTS.HYPERCHARGE;
                const hcMissing = Math.max(0, hcAvailable - hcOwned);
                missingHypercharges += hcMissing;
                costToMaxCoins += hcMissing * GameConstants.ITEM_COSTS.HYPERCHARGE;
            }
        });

        // Calculate for missing brawlers
        const ownedNames = ownedBrawlers.map(b => b.name);
        const missingBrawlers = allBrawlersRef
            .map(b => b.name)
            .filter(name => !ownedNames.includes(name));

        missingBrawlers.forEach(brawlerName => {
            const brawlerRef = allBrawlersRef.find(br => br.name === brawlerName);
            if (brawlerRef) {
                // Cost to get to P11
                for (let p = 1; p <= 11; p++) {
                    costToMaxCoins += GameConstants.COIN_COSTS[p];
                    costToMaxPowerPoints += GameConstants.POWER_POINT_COSTS[p];
                }
                belowP11++;

                // All items
                const gadgetsAvailable = (brawlerRef.gadgets || []).length;
                const spAvailable = (brawlerRef.starPowers || []).length;
                const hcAvailable = (brawlerRef.hyperCharges || []).length;

                missingGadgets += gadgetsAvailable;
                missingStarPowers += spAvailable;
                missingHypercharges += hcAvailable;

                costToMaxCoins += gadgetsAvailable * GameConstants.ITEM_COSTS.GADGET;
                costToMaxCoins += spAvailable * GameConstants.ITEM_COSTS.STAR_POWER;
                costToMaxCoins += hcAvailable * GameConstants.ITEM_COSTS.HYPERCHARGE;
            }
        });

        const totalCoins = currentWorthCoins + costToMaxCoins;
        const totalPowerPoints = currentWorthPowerPoints + costToMaxPowerPoints;
        const progressPercent = totalCoins > 0 ? Math.round((currentWorthCoins / totalCoins) * 100) : 0;

        return {
            currentWorthCoins,
            currentWorthPowerPoints,
            costToMaxCoins,
            costToMaxPowerPoints,
            totalCoins,
            totalPowerPoints,
            progressPercent,
            missingBrawlers,
            missingItems: {
                gadgets: missingGadgets,
                starPowers: missingStarPowers,
                hypercharges: missingHypercharges,
                belowP11
            }
        };
    }
};
