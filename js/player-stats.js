// Player Stats module - detailed player analysis

const PlayerStatsManager = {
    currentPlayer: null,
    brawlersRef: null,

    displayPlayerStats(clubIndex, playerIndex) {
        this.currentPlayer = DataManager.getPlayer(clubIndex, playerIndex);
        this.brawlersRef = DataManager.brawlersData.items;

        const container = document.getElementById('playerStatsContainer');
        container.innerHTML = this.generatePlayerHTML();

        // Create charts after HTML is rendered
        const prestigeStats = this.getPrestigeStats();
        const powerDistribution = this.getPowerDistribution();
        const trophyTimeline = this.getTrophyTimeline();
        PlayerChartsManager.createPrestigeChart(prestigeStats);
        PlayerChartsManager.createPowerChart(powerDistribution);
        PlayerChartsManager.createPlayerTrophyChart(trophyTimeline);

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

                <div class="card">
                    <h3>Prestige Distribution</h3>
                    <p style="margin-bottom: 10px; font-size: 0.9rem; color: var(--text-secondary);">Prestige levels based on brawler trophies (1k = prestige 1, 2k = prestige 2, etc.)</p>
                    <div style="height: 250px; margin: 15px 0;">
                        <canvas id="playerPrestigeChart"></canvas>
                    </div>
                    ${firstPrestigeStats.html}
                </div>
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

                ${this.generateBrawlerTable()}
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
        const stats = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        this.currentPlayer.brawlers.forEach(b => {
            const prestige = Math.floor(b.trophies / 1000);
            const level = Math.min(prestige, 5); // Cap at 5+
            stats[level]++;
        });
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
        const timeline = { dates: [], trophies: [] };

        DataManager.historicalData.forEach(snapshot => {
            const player = DataManager.findPlayerInSnapshot(snapshot, this.currentPlayer.tag);
            if (player) {
                timeline.dates.push(snapshot.date);
                timeline.trophies.push(player.trophies);
            }
        });

        return timeline;
    },

    getTrendIndicatorsHTML() {
        const timeline = this.getTrophyTimeline();
        if (timeline.trophies.length < 2) {
            return '<div style="margin: 10px 0; color: var(--text-secondary); font-size: 0.9rem;">Not enough data for trends</div>';
        }

        const current = timeline.trophies[timeline.trophies.length - 1];
        const yesterday = timeline.trophies.length >= 2 ? timeline.trophies[timeline.trophies.length - 2] : current;
        const weekAgo = timeline.trophies.length >= 8 ? timeline.trophies[timeline.trophies.length - 8] : timeline.trophies[0];
        const monthAgo = timeline.trophies.length >= 31 ? timeline.trophies[timeline.trophies.length - 31] : timeline.trophies[0];

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
        const table = document.querySelector('.data-table');

        if (!searchInput || !filterSelect || !table) return;

        const applyFilters = () => {
            const searchTerm = searchInput.value.toLowerCase();
            const filterType = filterSelect.value;
            const rows = table.querySelectorAll('tbody tr');

            rows.forEach(row => {
                const brawlerName = row.querySelector('td:first-child strong').textContent.toLowerCase();
                const matchesSearch = brawlerName.includes(searchTerm);

                let matchesFilter = true;
                if (filterType === 'maxed') {
                    matchesFilter = row.classList.contains('brawler-maxed');
                } else if (filterType === 'missing') {
                    matchesFilter = row.classList.contains('brawler-missing');
                } else if (filterType === 'not-p11') {
                    const powerCell = row.querySelector('td:nth-child(2)').textContent;
                    matchesFilter = powerCell !== 'P11';
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
            let filteredTimeline = { dates: [], trophies: [] };

            if (range === 'all') {
                filteredTimeline = fullTimeline;
            } else {
                const dataLength = fullTimeline.dates.length;
                let startIndex = 0;

                if (range === 'yesterday') {
                    startIndex = Math.max(0, dataLength - 2);
                } else if (range === 'week') {
                    startIndex = Math.max(0, dataLength - 8);
                } else if (range === 'month') {
                    startIndex = Math.max(0, dataLength - 31);
                }

                filteredTimeline.dates = fullTimeline.dates.slice(startIndex);
                filteredTimeline.trophies = fullTimeline.trophies.slice(startIndex);
            }

            PlayerChartsManager.createPlayerTrophyChart(filteredTimeline);
        });
    }
};
