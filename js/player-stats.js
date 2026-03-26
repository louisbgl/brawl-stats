// Player Stats module - detailed player analysis

const PlayerStatsManager = {
    currentPlayer: null,
    brawlersRef: null,

    displayPlayerStats(clubIndex, playerIndex) {
        try {
            this.currentPlayer = DataManager.getPlayer(clubIndex, playerIndex);
            this.brawlersRef = DataManager.brawlersData.items;

            const container = document.getElementById('playerStatsContainer');
            container.innerHTML = this.generatePlayerHTML();
        } catch (error) {
            console.error('Error displaying player stats:', error);
            document.getElementById('playerStatsContainer').innerHTML =
                `<div class="loading" style="color: var(--accent-red);">Error loading player stats: ${error.message}</div>`;
            return;
        }

        // Create charts after HTML is rendered
        const prestigeStats = this.getPrestigeStats();
        const powerDistribution = this.getPowerDistribution();
        const trophyTimeline = this.getTrophyTimeline();
        PlayerChartsManager.createPrestigeChart(prestigeStats);
        PlayerChartsManager.createPowerChart(powerDistribution);
        PlayerChartsManager.createPlayerTrophyChart(trophyTimeline);

        // Create mode distribution chart if battlelog data exists
        if (BattlelogDataManager.isLoaded) {
            const battles = BattlelogDataManager.getBattlesForPlayer(this.currentPlayer.tag);
            if (battles.length > 0) {
                PlayerChartsManager.createModeDistributionChart(this.currentPlayer.tag);
                PlayerChartsManager.createActivityHeatmap(this.currentPlayer.tag);
            }
        }

        // Setup filters
        this.setupBrawlerFilter();
        this.setupTrophyTimelineFilter();
    },

    generatePlayerHTML() {
        const p = this.currentPlayer;

        // Calculate stats
        const maxedBrawlers = this.getMaxedBrawlersCount();
        const missingBrawlers = this.getMissingBrawlers();
        const powerDistribution = this.getPowerDistribution();
        const prestigeStats = this.getPrestigeStats();
        const firstPrestigeStats = this.getFirstPrestigeDates();

        return `
            <div class="card">
                <h2>${p.name} <span style="color: var(--text-secondary); font-size: 1rem;">${p.tag}</span></h2>

                <div class="stats-grid">
                    <div class="stat-box">
                        <div class="stat-label">Current Trophies</div>
                        <div class="stat-value highlight-blue">${p.trophies.toLocaleString()}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Max Trophies</div>
                        <div class="stat-value highlight-purple">${p.highest_trophies.toLocaleString()}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Brawlers Owned</div>
                        <div class="stat-value highlight-green">${p.brawlers.length}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Maxed Brawlers</div>
                        <div class="stat-value highlight-orange">${maxedBrawlers}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Avg Trophies/Brawler</div>
                        <div class="stat-value">${this.getAvgTrophies()}</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                    <h3 style="margin-bottom: 0;">Trophy Progression</h3>
                    <select id="trophyTimelineRangeSelect" style="margin-bottom: 0; width: auto; min-width: 150px;">
                        <option value="all">All Time</option>
                        <option value="month">Last Month</option>
                        <option value="week">Last Week</option>
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                    </select>
                </div>

                ${this.getTrendIndicatorsHTML()}

                <div style="height: 200px; margin-top: 15px;">
                    <canvas id="playerTrophyTimelineChart"></canvas>
                </div>
            </div>

            <div class="two-col">
                <div class="card">
                    <h3>Gamemode Wins</h3>
                    <p style="margin-bottom: 15px; font-size: 0.9rem; color: var(--text-secondary);">Total victories from daily snapshot data</p>
                    <div class="stats-grid">
                        <div class="stat-box">
                            <div class="stat-label">3v3 Wins</div>
                            <div class="stat-value">${p.victories_3v3.toLocaleString()}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">Solo Wins</div>
                            <div class="stat-value">${p.solo_victories.toLocaleString()}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">Duo Wins</div>
                            <div class="stat-value">${p.duo_victories.toLocaleString()}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">Total Wins</div>
                            <div class="stat-value highlight-green">${(p.victories_3v3 + p.solo_victories + p.duo_victories).toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                ${this.generateGameModeDistributionHTML()}
            </div>

            ${this.generateBattlePerformanceHTML()}

            ${this.generateBrawlerRankingsHTML()}

            ${this.generateBrawlerBattleStatsHTML()}

            ${this.generateTeammateChemistryHTML()}

            ${this.generateActivityHeatmapHTML()}

            <div class="card">
                <h3>Prestige Distribution</h3>
                <p style="margin-bottom: 10px; font-size: 0.9rem; color: var(--text-secondary);">Number of brawlers at each prestige level</p>
                <div style="height: 300px; margin: 15px 0;">
                    <canvas id="playerPrestigeChart"></canvas>
                </div>
                ${firstPrestigeStats.html}
            </div>

            <div class="card">
                <h3>Power Level Distribution</h3>
                <p style="margin-bottom: 10px; font-size: 0.9rem; color: var(--text-secondary);">Shows how many brawlers are at each power level (P1 to P11)</p>
                <div style="height: 250px; margin: 15px 0;">
                    <canvas id="playerPowerChart"></canvas>
                </div>
            </div>

            ${this.generateAccountWorthHTML()}

            <div class="card">
                <h3>Brawler Details</h3>
                <p style="margin-bottom: 10px; font-size: 0.9rem; color: var(--text-secondary);">
                    <span style="color: var(--accent-green);">Green</span> = fully maxed,
                    <span style="color: var(--accent-orange);">Yellow</span> = nearly maxed,
                    <span style="color: var(--accent-red);">Red</span> = missing items.
                    Buffies excluded (API data unreliable).
                </p>

                <div style="margin-bottom: 15px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <input
                        type="text"
                        id="brawlerSearchInput"
                        placeholder="Search brawler name..."
                        style="flex: 1; min-width: 200px; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary);"
                    />
                    <select id="brawlerFilterSelect" style="width: auto; min-width: 180px;">
                        <option value="all">All Brawlers</option>
                        <option value="maxed">Fully Maxed</option>
                        <option value="missing">Missing Items</option>
                        <option value="not-p11">Not Power 11</option>
                    </select>
                </div>

                <div id="brawlerDetailsTableContainer">
                    ${this.generateBrawlerTable()}
                </div>
            </div>
        `;
    },

    getMaxedBrawlersCount() {
        return this.currentPlayer.brawlers.filter(b =>
            b.power === 11 &&
            b.gadget_ids.length >= 2 &&
            b.star_power_ids.length >= 2 &&
            b.hyper_charge_ids.length >= 1
        ).length;
    },

    getMissingBrawlers() {
        const owned = this.currentPlayer.brawlers.map(b => b.name);
        return this.brawlersRef
            .map(b => b.name)
            .filter(name => !owned.includes(name));
    },

    getPowerDistribution() {
        const dist = {};
        for (let i = 1; i <= 11; i++) dist[i] = 0;
        this.currentPlayer.brawlers.forEach(b => dist[b.power]++);
        return dist;
    },

    getPrestigeStats() {
        const stats = {};
        let maxPrestige = 3; // Always show at least 0-3

        this.currentPlayer.brawlers.forEach(b => {
            const prestige = Math.floor(b.trophies / 1000);
            stats[prestige] = (stats[prestige] || 0) + 1;
            if (prestige > maxPrestige) maxPrestige = prestige;
        });

        // Ensure we have entries for all prestige levels from 0 to max
        for (let i = 0; i <= maxPrestige; i++) {
            if (!stats[i]) stats[i] = 0;
        }

        return stats;
    },

    getFirstPrestigeDates() {
        const firstDates = { 2: null, 3: null, 4: null, 5: null };

        DataManager.historicalData.forEach(snapshot => {
            const player = DataManager.findPlayerInSnapshot(snapshot, this.currentPlayer.tag);
            if (player) {
                player.brawlers.forEach(b => {
                    const prestige = Math.floor(b.trophies / 1000);
                    for (let level = 2; level <= 5; level++) {
                        if (prestige >= level && !firstDates[level]) {
                            firstDates[level] = snapshot.date;
                        }
                    }
                });
            }
        });

        let html = '<div style="margin-top: 15px; font-size: 0.9rem;">';
        for (let level = 2; level <= 5; level++) {
            if (firstDates[level]) {
                html += `<div style="margin: 5px 0; color: var(--text-secondary);">
                    First Prestige ${level}: <strong style="color: var(--accent-green)">${firstDates[level]}</strong>
                </div>`;
            }
        }
        html += '</div>';

        return { dates: firstDates, html };
    },


    getAvgTrophies() {
        if (this.currentPlayer.brawlers.length === 0) return 0;
        const total = this.currentPlayer.brawlers.reduce((sum, b) => sum + b.trophies, 0);
        return Math.round(total / this.currentPlayer.brawlers.length);
    },

    getItemName(items, id) {
        const item = items.find(i => i.id === id);
        return item ? item.name : null;
    },

    generateBrawlerTable() {
        // Sort alphabetically by name
        const brawlers = [...this.currentPlayer.brawlers].sort((a, b) => a.name.localeCompare(b.name));

        let html = '<table class="data-table"><thead><tr>';
        html += '<th>Brawler</th><th>Power</th>';
        html += '<th>Gadgets</th><th>Star Powers</th><th>Hypercharge</th>';
        html += '<th>Gears</th></tr></thead><tbody>';

        brawlers.forEach(b => {
            const brawlerRef = this.brawlersRef.find(br => br.name === b.name);
            if (!brawlerRef) return;

            // Get item names
            const gadget1 = this.getItemName(brawlerRef.gadgets || [], b.gadget_ids[0]);
            const gadget2 = this.getItemName(brawlerRef.gadgets || [], b.gadget_ids[1]);
            const sp1 = this.getItemName(brawlerRef.starPowers || [], b.star_power_ids[0]);
            const sp2 = this.getItemName(brawlerRef.starPowers || [], b.star_power_ids[1]);
            const hc = this.getItemName(brawlerRef.hyperCharges || [], b.hyper_charge_ids[0]);

            // Determine row color class based on completion status
            const isMaxed = b.power === 11 && gadget1 && gadget2 && sp1 && sp2 && hc;
            const hasMissingItems = !gadget1 || !gadget2 || !sp1 || !sp2 || !hc;
            const isAlmostMaxed = b.power < 11 || b.gear_ids.length < 6;

            let rowClass = '';
            if (isMaxed && !hasMissingItems) {
                rowClass = 'brawler-maxed';
            } else if (hasMissingItems) {
                rowClass = 'brawler-missing';
            } else if (isAlmostMaxed) {
                rowClass = 'brawler-almost';
            }

            html += `<tr class="${rowClass}">`;
            html += `<td><strong>${b.name}</strong></td>`;
            html += `<td>P${b.power}</td>`;
            html += `<td>${this.formatItems([gadget1, gadget2])}</td>`;
            html += `<td>${this.formatItems([sp1, sp2])}</td>`;
            html += `<td>${hc ? `<span class="badge owned">${hc}</span>` : '<span class="badge missing">Missing</span>'}</td>`;
            html += `<td>${b.gear_ids.length}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    },

    formatItems(items) {
        return items.map(item =>
            item ? `<span class="badge owned">${item}</span>` : '<span class="badge missing">Missing</span>'
        ).join(' ');
    },

    getTrophyTimeline() {
        const timeline = {
            dates: [],
            trophies: [],
            sources: [],
            snapshotDates: [],
            snapshotTrophies: [],
            snapshotTimestamps: []
        };

        // Store daily snapshots separately for trend calculations
        DataManager.historicalData.forEach(snapshot => {
            const player = DataManager.findPlayerInSnapshot(snapshot, this.currentPlayer.tag);
            if (player) {
                timeline.snapshotDates.push(snapshot.date);
                timeline.snapshotTrophies.push(player.trophies);
                timeline.snapshotTimestamps.push(snapshot.timestamp);
            }
        });


        // If no battlelog data, just use snapshots
        if (!BattlelogDataManager.isLoaded) {
            timeline.dates = [...timeline.snapshotDates];
            timeline.trophies = [...timeline.snapshotTrophies];
            timeline.sources = new Array(timeline.dates.length).fill('snapshot');
            return timeline;
        }

        const battles = BattlelogDataManager.getBattlesForPlayer(this.currentPlayer.tag);
        if (battles.length === 0) {
            timeline.dates = [...timeline.snapshotDates];
            timeline.trophies = [...timeline.snapshotTrophies];
            timeline.sources = new Array(timeline.dates.length).fill('snapshot');
            return timeline;
        }

        // Build timeline: snapshots are source of truth, battles add granularity
        // Algorithm: Add all snapshots as anchor points, then reconstruct trophy counts using battles
        const points = [];

        // Add all snapshot points
        timeline.snapshotDates.forEach((date, i) => {
            points.push({
                date: new Date(timeline.snapshotTimestamps[i]),
                dateStr: date,
                trophies: timeline.snapshotTrophies[i],
                source: 'snapshot',
                isAnchor: true
            });
        });

        // If we have snapshots, add battle granularity between snapshots
        if (timeline.snapshotTimestamps.length > 0) {
            // Convert battles to sorted list with timestamps
            const battlesWithTime = battles.map(b => {
                const date = Utils.parseBattleTime(b.battleTime);
                return {
                    time: date,
                    timeStr: date ? date.toISOString() : null,
                    trophyChange: b.battle.trophyChange || 0
                };
            }).filter(b => b.time !== null).sort((a, b) => a.time - b.time);

            // Process battles between snapshots
            for (let snapshotIdx = 0; snapshotIdx < timeline.snapshotTimestamps.length; snapshotIdx++) {
                const snapshotTime = new Date(timeline.snapshotTimestamps[snapshotIdx]);
                const snapshotTrophies = timeline.snapshotTrophies[snapshotIdx];
                const nextSnapshotTime = snapshotIdx < timeline.snapshotTimestamps.length - 1
                    ? new Date(timeline.snapshotTimestamps[snapshotIdx + 1])
                    : new Date(); // For the last snapshot, go up to now

                // Find battles between this snapshot and the next
                const battlesInRange = battlesWithTime.filter(b =>
                    b.time > snapshotTime && b.time <= nextSnapshotTime
                );

                if (battlesInRange.length > 0) {
                    // Working backwards from the next snapshot (or current trophy count)
                    let currentTrophies = snapshotIdx < timeline.snapshotTimestamps.length - 1
                        ? timeline.snapshotTrophies[snapshotIdx + 1]
                        : snapshotTrophies; // For last snapshot, start from its value

                    // If this is the last snapshot, calculate forward from it
                    if (snapshotIdx === timeline.snapshotTimestamps.length - 1) {
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
                        // For battles between two snapshots, work backwards from next snapshot
                        // to ensure we end up at the correct trophy count
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
    },

    getTrendIndicatorsHTML() {
        const timeline = this.getTrophyTimeline();
        if (timeline.snapshotTrophies.length < 2) {
            return '<div style="margin: 10px 0; color: var(--text-secondary); font-size: 0.9rem;">Not enough data for trends</div>';
        }

        // Use snapshot data for trend calculations
        const snapshots = timeline.snapshotTrophies;
        const current = snapshots[snapshots.length - 1];
        const yesterday = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : current;
        const weekAgo = snapshots.length >= 8 ? snapshots[snapshots.length - 8] : snapshots[0];
        const monthAgo = snapshots.length >= 31 ? snapshots[snapshots.length - 31] : snapshots[0];

        const dayChange = current - yesterday;
        const weekChange = current - weekAgo;
        const monthChange = current - monthAgo;

        const formatTrend = (change, label) => {
            const sign = change >= 0 ? '+' : '';
            const color = change >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
            const arrow = change >= 0 ? '↑' : '↓';
            return `
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--bg-secondary); border-radius: 6px;">
                    <span style="font-size: 0.8rem; color: var(--text-secondary); min-width: 60px;">${label}</span>
                    <span style="color: ${color}; font-weight: 700; font-size: 1.1rem;">${arrow} ${sign}${Math.abs(change).toLocaleString()}</span>
                </div>
            `;
        };

        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-top: 12px;">
                ${formatTrend(dayChange, '1 Day')}
                ${formatTrend(weekChange, '7 Days')}
                ${formatTrend(monthChange, '30 Days')}
            </div>
        `;
    },

    generateAccountWorthHTML() {
        // Calculate upgrade costs
        const costs = this.calculateUpgradeCosts();

        if (costs.totalCoins === 0) {
            return '';
        }

        const missingBrawlersHTML = costs.missingBrawlers.length > 0 ? `
            <div style="margin-top: 20px;">
                <h4 style="font-size: 1rem; margin-bottom: 10px;">Missing Brawlers (${costs.missingBrawlers.length})</h4>
                <div class="missing-list">
                    ${costs.missingBrawlers.map(b => `<div class="missing-item">${b}</div>`).join('')}
                </div>
            </div>
        ` : '';

        return `
            <div class="card" style="position: relative;">
                <div style="position: absolute; top: 24px; right: 24px;">
                    <div style="background: var(--bg-secondary); padding: 8px 12px; border-radius: 6px; border: 2px solid var(--accent-purple); display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.7rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Progress</span>
                        <span style="font-size: 1.15rem; font-weight: 700; color: var(--accent-purple);">${costs.progressPercent}%</span>
                    </div>
                </div>

                <h3>Account Worth & Progression</h3>
                <p style="margin-bottom: 15px; font-size: 0.9rem; color: var(--text-secondary); max-width: 75%;">
                    Estimated costs based on power points, coins, and item unlocks.
                    <strong>Note:</strong> Does not include buffies or gears in calculations.
                </p>

                <div class="two-col">
                    <div>
                        <h4 style="font-size: 0.95rem; margin-bottom: 10px; color: var(--text-secondary); text-transform: uppercase;">Coins</h4>
                        <div class="stats-grid">
                            <div class="stat-box">
                                <div class="stat-label">Current Worth</div>
                                <div class="stat-value highlight-orange">${costs.currentWorthCoins.toLocaleString()}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">Cost to Max</div>
                                <div class="stat-value highlight-red">${costs.costToMaxCoins.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h4 style="font-size: 0.95rem; margin-bottom: 10px; color: var(--text-secondary); text-transform: uppercase;">Power Points</h4>
                        <div class="stats-grid">
                            <div class="stat-box">
                                <div class="stat-label">Current Worth</div>
                                <div class="stat-value highlight-blue">${costs.currentWorthPowerPoints.toLocaleString()}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">Cost to Max</div>
                                <div class="stat-value highlight-purple">${costs.costToMaxPowerPoints.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 20px;">
                    <h4 style="font-size: 1rem; margin-bottom: 10px;">Missing Items</h4>
                    <div class="stats-grid">
                        <div class="stat-box">
                            <div class="stat-label">Gadgets Missing</div>
                            <div style="font-size: 1.5rem; font-weight: 600;">${costs.missingItems.gadgets}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">Star Powers Missing</div>
                            <div style="font-size: 1.5rem; font-weight: 600;">${costs.missingItems.starPowers}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">Hypercharges Missing</div>
                            <div style="font-size: 1.5rem; font-weight: 600;">${costs.missingItems.hypercharges}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">Brawlers Below P11</div>
                            <div style="font-size: 1.5rem; font-weight: 600;">${costs.missingItems.belowP11}</div>
                        </div>
                    </div>
                </div>

                ${missingBrawlersHTML}
            </div>
        `;
    },

    calculateUpgradeCosts() {
        // Brawl Stars upgrade costs
        const POWER_POINT_COSTS = {
            1: 0,
            2: 20,
            3: 30,
            4: 50,
            5: 80,
            6: 130,
            7: 210,
            8: 340,
            9: 550,
            10: 890,
            11: 1440
        };

        const COIN_COSTS = {
            1: 0,
            2: 20,
            3: 35,
            4: 75,
            5: 140,
            6: 290,
            7: 480,
            8: 800,
            9: 1250,
            10: 1875,
            11: 2800
        };

        const GADGET_COST = 1000;
        const STAR_POWER_COST = 2000;
        const HYPERCHARGE_COST = 5000;

        let currentWorthCoins = 0;
        let currentWorthPowerPoints = 0;
        let costToMaxCoins = 0;
        let costToMaxPowerPoints = 0;
        let missingGadgets = 0;
        let missingStarPowers = 0;
        let missingHypercharges = 0;
        let belowP11 = 0;

        const totalBrawlers = this.brawlersRef.length;

        this.currentPlayer.brawlers.forEach(b => {
            // Power level costs
            for (let p = 1; p <= b.power; p++) {
                currentWorthCoins += COIN_COSTS[p];
                currentWorthPowerPoints += POWER_POINT_COSTS[p];
            }
            if (b.power < 11) {
                belowP11++;
                for (let p = b.power + 1; p <= 11; p++) {
                    costToMaxCoins += COIN_COSTS[p];
                    costToMaxPowerPoints += POWER_POINT_COSTS[p];
                }
            }

            const brawlerRef = this.brawlersRef.find(br => br.name === b.name);
            if (brawlerRef) {
                // Gadgets
                const gadgetsOwned = b.gadget_ids.length;
                const gadgetsAvailable = (brawlerRef.gadgets || []).length;
                currentWorthCoins += gadgetsOwned * GADGET_COST;
                const gadgetsMissing = Math.max(0, gadgetsAvailable - gadgetsOwned);
                missingGadgets += gadgetsMissing;
                costToMaxCoins += gadgetsMissing * GADGET_COST;

                // Star Powers
                const spOwned = b.star_power_ids.length;
                const spAvailable = (brawlerRef.starPowers || []).length;
                currentWorthCoins += spOwned * STAR_POWER_COST;
                const spMissing = Math.max(0, spAvailable - spOwned);
                missingStarPowers += spMissing;
                costToMaxCoins += spMissing * STAR_POWER_COST;

                // Hypercharges
                const hcOwned = b.hyper_charge_ids.length;
                const hcAvailable = (brawlerRef.hyperCharges || []).length;
                currentWorthCoins += hcOwned * HYPERCHARGE_COST;
                const hcMissing = Math.max(0, hcAvailable - hcOwned);
                missingHypercharges += hcMissing;
                costToMaxCoins += hcMissing * HYPERCHARGE_COST;
            }
        });

        // Add cost for missing brawlers (assume they need everything)
        const missingBrawlers = this.getMissingBrawlers();
        missingBrawlers.forEach(brawlerName => {
            const brawlerRef = this.brawlersRef.find(br => br.name === brawlerName);
            if (brawlerRef) {
                // Cost to get to P11
                for (let p = 1; p <= 11; p++) {
                    costToMaxCoins += COIN_COSTS[p];
                    costToMaxPowerPoints += POWER_POINT_COSTS[p];
                }
                belowP11++;

                // All items
                const gadgetsAvailable = (brawlerRef.gadgets || []).length;
                const spAvailable = (brawlerRef.starPowers || []).length;
                const hcAvailable = (brawlerRef.hyperCharges || []).length;

                missingGadgets += gadgetsAvailable;
                missingStarPowers += spAvailable;
                missingHypercharges += hcAvailable;

                costToMaxCoins += gadgetsAvailable * GADGET_COST;
                costToMaxCoins += spAvailable * STAR_POWER_COST;
                costToMaxCoins += hcAvailable * HYPERCHARGE_COST;
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
    },

    setupBrawlerFilter() {
        const searchInput = document.getElementById('brawlerSearchInput');
        const filterSelect = document.getElementById('brawlerFilterSelect');
        const tableContainer = document.getElementById('brawlerDetailsTableContainer');

        if (!searchInput || !filterSelect || !tableContainer) return;

        const applyFilters = () => {
            const table = tableContainer.querySelector('.data-table');
            if (!table) return;

            const searchTerm = searchInput.value.toLowerCase();
            const filterType = filterSelect.value;
            const rows = table.querySelectorAll('tbody tr');

            rows.forEach(row => {
                const brawlerNameCell = row.querySelector('td:first-child strong');
                if (!brawlerNameCell) return;

                const brawlerName = brawlerNameCell.textContent.toLowerCase();
                const matchesSearch = brawlerName.includes(searchTerm);

                let matchesFilter = true;
                if (filterType === 'maxed') {
                    matchesFilter = row.classList.contains('brawler-maxed');
                } else if (filterType === 'missing') {
                    matchesFilter = row.classList.contains('brawler-missing');
                } else if (filterType === 'not-p11') {
                    const powerCell = row.querySelector('td:nth-child(2)');
                    if (powerCell) {
                        matchesFilter = powerCell.textContent !== 'P11';
                    }
                }

                row.style.display = (matchesSearch && matchesFilter) ? '' : 'none';
            });
        };

        searchInput.addEventListener('input', applyFilters);
        filterSelect.addEventListener('change', applyFilters);
    },

    setupTrophyTimelineFilter() {
        const rangeSelect = document.getElementById('trophyTimelineRangeSelect');
        if (!rangeSelect) return;

        rangeSelect.addEventListener('change', () => {
            const range = rangeSelect.value;
            const fullTimeline = this.getTrophyTimeline();
            let filteredTimeline = {
                dates: [],
                trophies: [],
                sources: [],
                snapshotDates: [],
                snapshotTrophies: [],
                snapshotTimestamps: []
            };

            if (range === 'all') {
                filteredTimeline = fullTimeline;
            } else {
                const now = new Date();
                const todayStr = now.toISOString().split('T')[0];

                let cutoffDate;
                let endDate = null; // For "yesterday" which needs both start and end
                let needsAnchor = false; // Single-day filters need previous day's snapshot as anchor

                if (range === 'today') {
                    cutoffDate = new Date(todayStr);
                    needsAnchor = true;
                } else if (range === 'yesterday') {
                    const yesterday = new Date(now);
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayStr = yesterday.toISOString().split('T')[0];
                    cutoffDate = new Date(yesterdayStr);
                    endDate = new Date(todayStr);
                    needsAnchor = true;
                } else if (range === 'week') {
                    cutoffDate = new Date(now);
                    cutoffDate.setDate(cutoffDate.getDate() - 7);
                } else if (range === 'month') {
                    cutoffDate = new Date(now);
                    cutoffDate.setDate(cutoffDate.getDate() - 30);
                }

                if (cutoffDate) {
                    // For single-day filters, we need the snapshot from the day before as starting anchor
                    let anchorDate = null;
                    if (needsAnchor) {
                        anchorDate = new Date(cutoffDate);
                        anchorDate.setDate(anchorDate.getDate() - 1);
                    }

                    // Filter main timeline data points
                    for (let i = 0; i < fullTimeline.dates.length; i++) {
                        const pointDate = new Date(fullTimeline.dates[i]);
                        const inRange = endDate
                            ? (pointDate >= cutoffDate && pointDate < endDate)
                            : (pointDate >= cutoffDate);

                        // Include anchor snapshot if needed
                        const isAnchor = anchorDate && fullTimeline.sources[i] === 'snapshot' &&
                            pointDate.toISOString().split('T')[0] === anchorDate.toISOString().split('T')[0];

                        if (inRange || isAnchor) {
                            filteredTimeline.dates.push(fullTimeline.dates[i]);
                            filteredTimeline.trophies.push(fullTimeline.trophies[i]);
                            if (fullTimeline.sources) {
                                filteredTimeline.sources.push(fullTimeline.sources[i]);
                            }
                        }
                    }

                    // Filter snapshot arrays (needed for chart x-axis)
                    for (let i = 0; i < fullTimeline.snapshotDates.length; i++) {
                        const snapshotDate = new Date(fullTimeline.snapshotDates[i]);
                        const inRange = endDate
                            ? (snapshotDate >= cutoffDate && snapshotDate < endDate)
                            : (snapshotDate >= cutoffDate);

                        // Include anchor snapshot if needed
                        const isAnchor = anchorDate &&
                            snapshotDate.toISOString().split('T')[0] === anchorDate.toISOString().split('T')[0];

                        if (inRange || isAnchor) {
                            filteredTimeline.snapshotDates.push(fullTimeline.snapshotDates[i]);
                            filteredTimeline.snapshotTrophies.push(fullTimeline.snapshotTrophies[i]);
                            filteredTimeline.snapshotTimestamps.push(fullTimeline.snapshotTimestamps[i]);
                        }
                    }

                }
            }

            PlayerChartsManager.createPlayerTrophyChart(filteredTimeline);
        });
    },

    generateBattlePerformanceHTML() {
        if (!BattlelogDataManager.isLoaded) {
            return '';
        }

        const tag = this.currentPlayer.tag;
        const battles = BattlelogDataManager.getBattlesForPlayer(tag);

        if (battles.length === 0) {
            return `
                <div class="card">
                    <h3>Battle Performance</h3>
                    <p style="color: var(--text-secondary);">No battle data available yet</p>
                </div>
            `;
        }

        const overallWr = BattlelogAnalytics.getWinRate(tag);
        const starPlayerCount = BattlelogAnalytics.getStarPlayerCount(tag);
        const mvpRate = battles.length > 0 ? (starPlayerCount / battles.length) * 100 : 0;

        // Find best mode
        const modeCounts = {};
        const modeWins = {};
        battles.forEach(b => {
            const mode = b.event.mode;
            modeCounts[mode] = (modeCounts[mode] || 0) + 1;
            if (BattlelogAnalytics.isWin(b)) {
                modeWins[mode] = (modeWins[mode] || 0) + 1;
            }
        });

        let bestMode = 'N/A';
        let bestModeWr = 0;
        let bestModeGames = 0;
        for (const [mode, count] of Object.entries(modeCounts)) {
            if (count >= 5) {
                const wins = modeWins[mode] || 0;
                const wr = (wins / count) * 100;
                if (wr > bestModeWr) {
                    bestModeWr = wr;
                    bestMode = mode;
                    bestModeGames = count;
                }
            }
        }


        // Most MVPs with which brawler
        const brawlerMvps = {};
        battles.forEach(b => {
            const starPlayer = b.battle.starPlayer;
            if (starPlayer && starPlayer.tag === tag) {
                const brawlerName = starPlayer.brawler.name;
                brawlerMvps[brawlerName] = (brawlerMvps[brawlerName] || 0) + 1;
            }
        });

        let topMvpBrawler = 'N/A';
        let topMvpCount = 0;
        for (const [brawler, count] of Object.entries(brawlerMvps)) {
            if (count > topMvpCount) {
                topMvpCount = count;
                topMvpBrawler = brawler;
            }
        }

        return `
            <div class="card">
                <h3>Battle Performance</h3>
                <div class="two-col" style="margin-top: 15px;">
                    <div>
                        <h4 style="font-size: 0.95rem; margin-bottom: 12px; color: var(--text-secondary); text-transform: uppercase;">Win Rate Analysis</h4>
                        <div class="performance-stat">
                            <span class="performance-label">Overall WR</span>
                            <span class="performance-value highlight-blue">${overallWr.winRate.toFixed(1)}%</span>
                            <span class="performance-detail">(${overallWr.wins}W-${overallWr.losses}L)</span>
                        </div>
                        <div class="performance-stat">
                            <span class="performance-label">Best Mode</span>
                            <span class="performance-value highlight-green">${bestMode}</span>
                            <span class="performance-detail">${bestMode !== 'N/A' ? `${bestModeWr.toFixed(1)}% in ${bestModeGames} games` : ''}</span>
                        </div>
                    </div>
                    <div>
                        <h4 style="font-size: 0.95rem; margin-bottom: 12px; color: var(--text-secondary); text-transform: uppercase;">Star Player Stats</h4>
                        <div class="performance-stat">
                            <span class="performance-label">MVP Rate</span>
                            <span class="performance-value highlight-orange">${mvpRate.toFixed(1)}%</span>
                            <span class="performance-detail">(${starPlayerCount}/${battles.length} games)</span>
                        </div>
                        <div class="performance-stat">
                            <span class="performance-label">Most MVPs with</span>
                            <span class="performance-value highlight-purple">${topMvpBrawler}</span>
                            <span class="performance-detail">${topMvpCount > 0 ? `${topMvpCount} times` : ''}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    generateBrawlerRankingsHTML() {
        if (!BattlelogDataManager.isLoaded) {
            return '';
        }

        const tag = this.currentPlayer.tag;
        const battles = BattlelogDataManager.getBattlesForPlayer(tag);

        if (battles.length === 0) {
            return '';
        }

        // Aggregate brawler stats - need to find which brawler the player used
        const brawlerStats = {};
        battles.forEach(b => {
            let brawlerName = null;

            // Team modes
            if (b.battle.teams) {
                for (const team of b.battle.teams) {
                    const player = team.find(p => p.tag === tag);
                    if (player) {
                        brawlerName = player.brawler.name;
                        break;
                    }
                }
            }

            // Solo showdown
            if (!brawlerName && b.battle.players) {
                const player = b.battle.players.find(p => p.tag === tag);
                if (player) {
                    brawlerName = player.brawler.name;
                }
            }

            if (brawlerName) {
                if (!brawlerStats[brawlerName]) {
                    brawlerStats[brawlerName] = {
                        name: brawlerName,
                        games: 0,
                        wins: 0,
                        trophyChange: 0,
                        mvps: 0
                    };
                }
                brawlerStats[brawlerName].games++;
                if (BattlelogAnalytics.isWin(b)) brawlerStats[brawlerName].wins++;
                brawlerStats[brawlerName].trophyChange += b.battle.trophyChange || 0;

                const starPlayer = b.battle.starPlayer;
                if (starPlayer && starPlayer.tag === tag && starPlayer.brawler.name === brawlerName) {
                    brawlerStats[brawlerName].mvps++;
                }
            }
        });

        const brawlerArray = Object.values(brawlerStats).filter(b => b.games >= 10);
        brawlerArray.forEach(b => b.winRate = (b.wins / b.games) * 100);

        const byWinRate = [...brawlerArray].sort((a, b) => b.winRate - a.winRate).slice(0, 5);
        const byGames = [...brawlerArray].sort((a, b) => b.games - a.games).slice(0, 5);
        const byTrophies = [...brawlerArray].sort((a, b) => b.trophyChange - a.trophyChange).slice(0, 5);
        const byMvps = [...brawlerArray].sort((a, b) => b.mvps - a.mvps).slice(0, 5);

        const rankingList = (list, valueFn) => list.map((b, i) =>
            `<div class="ranking-item">
                <span class="ranking-pos">${i + 1}.</span>
                <span class="ranking-brawler">${b.name}</span>
                <span class="ranking-value">${valueFn(b)}</span>
            </div>`
        ).join('');

        return `
            <div class="card">
                <h3>Brawler Performance Rankings</h3>
                <p style="margin-bottom: 15px; font-size: 0.9rem; color: var(--text-secondary);">Top 5 brawlers by different metrics (min 10 games)</p>
                <div class="ranking-grid">
                    <div class="ranking-column">
                        <h4 class="ranking-title">Highest Win Rate</h4>
                        ${rankingList(byWinRate, b => `${b.winRate.toFixed(1)}%`)}
                    </div>
                    <div class="ranking-column">
                        <h4 class="ranking-title">Most Played</h4>
                        ${rankingList(byGames, b => `${b.games} games`)}
                    </div>
                    <div class="ranking-column">
                        <h4 class="ranking-title">Trophy Grinders</h4>
                        ${rankingList(byTrophies, b => `${b.trophyChange > 0 ? '+' : ''}${b.trophyChange}`)}
                    </div>
                    <div class="ranking-column">
                        <h4 class="ranking-title">MVP Machines</h4>
                        ${rankingList(byMvps, b => `${b.mvps} MVPs`)}
                    </div>
                </div>
            </div>
        `;
    },

    generateGameModeDistributionHTML() {
        if (!BattlelogDataManager.isLoaded) {
            return '';
        }

        const tag = this.currentPlayer.tag;
        const battles = BattlelogDataManager.getBattlesForPlayer(tag);

        if (battles.length === 0) {
            return '';
        }

        const modeCounts = {};
        battles.forEach(b => {
            const mode = b.event.mode;
            modeCounts[mode] = (modeCounts[mode] || 0) + 1;
        });

        const total = battles.length;
        const modeData = Object.entries(modeCounts)
            .map(([mode, count]) => ({
                mode,
                count,
                percentage: (count / total) * 100
            }))
            .sort((a, b) => b.count - a.count);

        return `
            <div class="card">
                <h3>Game Mode Distribution</h3>
                <p style="margin-bottom: 15px; font-size: 0.9rem; color: var(--text-secondary);">Percentage of games played in each mode</p>
                <div style="height: 300px; margin: 15px 0;">
                    <canvas id="playerModeChart"></canvas>
                </div>
            </div>
        `;
    },

    generateBrawlerBattleStatsHTML() {
        if (!BattlelogDataManager.isLoaded) {
            return '';
        }

        const tag = this.currentPlayer.tag;
        const battles = BattlelogDataManager.getBattlesForPlayer(tag);

        if (battles.length === 0) {
            return '';
        }

        // Aggregate brawler stats
        const brawlerStats = {};
        battles.forEach(b => {
            let brawlerName = null;

            if (b.battle.teams) {
                for (const team of b.battle.teams) {
                    const player = team.find(p => p.tag === tag);
                    if (player) {
                        brawlerName = player.brawler.name;
                        break;
                    }
                }
            }

            if (!brawlerName && b.battle.players) {
                const player = b.battle.players.find(p => p.tag === tag);
                if (player) {
                    brawlerName = player.brawler.name;
                }
            }

            if (brawlerName) {
                if (!brawlerStats[brawlerName]) {
                    brawlerStats[brawlerName] = {
                        name: brawlerName,
                        games: 0,
                        wins: 0,
                        trophyChange: 0,
                        mvps: 0,
                        lastPlayed: b.battleTime
                    };
                }
                brawlerStats[brawlerName].games++;
                if (BattlelogAnalytics.isWin(b)) brawlerStats[brawlerName].wins++;
                brawlerStats[brawlerName].trophyChange += b.battle.trophyChange || 0;

                const starPlayer = b.battle.starPlayer;
                if (starPlayer && starPlayer.tag === tag && starPlayer.brawler.name === brawlerName) {
                    brawlerStats[brawlerName].mvps++;
                }

                // Update last played if more recent
                const currentBattleDate = Utils.parseBattleTime(b.battleTime);
                const lastPlayedDate = Utils.parseBattleTime(brawlerStats[brawlerName].lastPlayed);
                if (currentBattleDate && lastPlayedDate && currentBattleDate > lastPlayedDate) {
                    brawlerStats[brawlerName].lastPlayed = b.battleTime;
                }
            }
        });

        const brawlerArray = Object.values(brawlerStats);
        brawlerArray.forEach(b => b.winRate = (b.wins / b.games) * 100);
        brawlerArray.sort((a, b) => b.games - a.games);

        const formatLastPlayed = (dateStr) => {
            if (!dateStr) return 'Unknown';
            // Convert 20260324T161433.000Z to ISO format
            const isoDate = dateStr.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6');
            const date = new Date(isoDate);
            if (isNaN(date.getTime())) return 'Unknown';
            const now = new Date();
            const diffMs = now - date;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            return `${diffDays} days ago`;
        };

        const tableRows = brawlerArray.map(b => `
            <tr>
                <td><strong>${b.name}</strong></td>
                <td>${b.games}</td>
                <td>${b.wins}-${b.games - b.wins} (${b.winRate.toFixed(1)}%)</td>
                <td class="${b.trophyChange >= 0 ? 'trophy-positive' : 'trophy-negative'}">${b.trophyChange > 0 ? '+' : ''}${b.trophyChange}</td>
                <td>${formatLastPlayed(b.lastPlayed)}</td>
                <td>${b.mvps}</td>
            </tr>
        `).join('');

        return `
            <div class="card">
                <h3>Brawler Battle Stats</h3>
                <p style="margin-bottom: 15px; font-size: 0.9rem; color: var(--text-secondary);">Detailed battle performance per brawler from battlelog data</p>
                <div style="overflow-x: auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Brawler</th>
                                <th>Games</th>
                                <th>Win Rate</th>
                                <th>Net Trophies</th>
                                <th>Last Played</th>
                                <th>MVPs</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    generateTeammateChemistryHTML() {
        if (!BattlelogDataManager.isLoaded) {
            return '';
        }

        const tag = this.currentPlayer.tag;
        const battles = BattlelogDataManager.getBattlesForPlayer(tag);

        if (battles.length === 0) {
            return '';
        }

        // Get all tracked player tags
        const trackedPlayers = DataManager.getAllPlayers();
        const trackedTags = new Set(trackedPlayers.map(p => p.tag));

        // Track teammate stats
        const teammateStats = {};

        battles.forEach(b => {
            // Only team modes have teammates
            if (b.battle.teams) {
                for (const team of b.battle.teams) {
                    const playerInTeam = team.find(p => p.tag === tag);
                    if (playerInTeam) {
                        // Found our team, track teammates
                        team.forEach(p => {
                            if (p.tag !== tag && trackedTags.has(p.tag)) { // Not self and is tracked player
                                if (!teammateStats[p.tag]) {
                                    teammateStats[p.tag] = {
                                        tag: p.tag,
                                        name: p.name,
                                        games: 0,
                                        wins: 0
                                    };
                                }
                                teammateStats[p.tag].games++;
                                if (BattlelogAnalytics.isWin(b)) {
                                    teammateStats[p.tag].wins++;
                                }
                            }
                        });
                        break;
                    }
                }
            }
        });

        const teammateArray = Object.values(teammateStats);
        if (teammateArray.length === 0) {
            return `
                <div class="card">
                    <h3>Teammate Chemistry</h3>
                    <p style="color: var(--text-secondary);">No teammate data available (only solo modes played)</p>
                </div>
            `;
        }

        teammateArray.forEach(t => t.winRate = (t.wins / t.games) * 100);
        teammateArray.sort((a, b) => b.winRate - a.winRate);

        const teammateList = teammateArray.map((t, i) => `
            <div class="teammate-item">
                <span class="teammate-rank">${i + 1}.</span>
                <span class="teammate-name">${t.name}</span>
                <span class="teammate-wr">${t.winRate.toFixed(1)}%</span>
                <span class="teammate-games">${t.games} games</span>
                <span class="teammate-record">${t.wins}W-${t.games - t.wins}L</span>
            </div>
        `).join('');

        return `
            <div class="card">
                <h3>Teammate Chemistry</h3>
                <p style="margin-bottom: 15px; font-size: 0.9rem; color: var(--text-secondary);">Win rate when playing with each teammate (all modes combined)</p>
                <div class="teammate-list">
                    ${teammateList}
                </div>
            </div>
        `;
    },

    generateActivityHeatmapHTML() {
        if (!BattlelogDataManager.isLoaded) {
            return '';
        }

        const tag = this.currentPlayer.tag;
        const battles = BattlelogDataManager.getBattlesForPlayer(tag);

        if (battles.length === 0) {
            return '';
        }

        return `
            <div class="card">
                <h3>Activity Heatmap</h3>
                <p style="margin-bottom: 15px; font-size: 0.9rem; color: var(--text-secondary);">When you play most (by hour and day of week)</p>
                <div style="height: 350px; margin-top: 15px;">
                    <canvas id="playerActivityHeatmap"></canvas>
                </div>
            </div>
        `;
    }
};
