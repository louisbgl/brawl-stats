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
        PlayerChartsManager.createPrestigeChart(prestigeStats);
        PlayerChartsManager.createPowerChart(powerDistribution);
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

            ${missingBrawlers.length > 0 ? `
                <div class="card">
                    <h3>Missing Brawlers (${missingBrawlers.length})</h3>
                    <div class="missing-list">
                        ${missingBrawlers.map(b => `<div class="missing-item">${b}</div>`).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="card">
                <h3>Brawler Details</h3>
                <p style="margin-bottom: 10px; font-size: 0.9rem; color: var(--text-secondary);">
                    <span style="color: var(--accent-green);">Green</span> = fully maxed,
                    <span style="color: var(--accent-orange);">Yellow</span> = nearly maxed,
                    <span style="color: var(--accent-red);">Red</span> = missing items.
                    Buffies excluded (API data unreliable).
                </p>
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
    }
};
