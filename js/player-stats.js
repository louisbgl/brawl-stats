// Player Stats module - detailed player analysis

const PlayerStatsManager = {
    currentPlayer: null,
    brawlersRef: null,

    displayPlayerStats(clubIndex, playerIndex) {
        this.currentPlayer = DataManager.getPlayer(clubIndex, playerIndex);
        this.brawlersRef = DataManager.brawlersData.items;

        const container = document.getElementById('playerStatsContainer');
        container.innerHTML = this.generatePlayerHTML();
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
                    <div class="stat-box">
                        <div class="stat-label">Experience Level</div>
                        <div class="stat-value">${p.exp_level}</div>
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
                    ${this.generatePrestigeChart(prestigeStats)}
                    ${firstPrestigeStats.html}
                </div>
            </div>

            <div class="card">
                <h3>Power Level Distribution</h3>
                ${this.generatePowerDistributionHTML(powerDistribution)}
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
            snapshot.clubs.forEach(club => {
                const player = club.members.find(p => p.tag === this.currentPlayer.tag);
                if (!player) return;

                player.brawlers.forEach(b => {
                    const prestige = Math.floor(b.trophies / 1000);
                    for (let level = 2; level <= 5; level++) {
                        if (prestige >= level && !firstDates[level]) {
                            firstDates[level] = snapshot.date;
                        }
                    }
                });
            });
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

    generatePrestigeChart(stats) {
        const labels = ['<1k', '1k-2k', '2k-3k', '3k-4k', '4k-5k', '5k+'];
        const data = [stats[0], stats[1], stats[2], stats[3], stats[4], stats[5]];
        const total = data.reduce((a, b) => a + b, 0);

        let html = '<div style="margin: 15px 0;">';
        data.forEach((count, idx) => {
            const pct = total > 0 ? (count / total * 100).toFixed(1) : 0;
            html += `
                <div style="display: flex; align-items: center; margin: 8px 0;">
                    <div style="width: 80px; font-size: 0.85rem; color: var(--text-secondary);">${labels[idx]}</div>
                    <div style="flex: 1; background: var(--bg-secondary); height: 25px; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${pct}%; height: 100%; background: var(--accent-blue); display: flex; align-items: center; justify-content: center; color: white; font-size: 0.8rem; font-weight: 600;">
                            ${count > 0 ? count : ''}
                        </div>
                    </div>
                    <div style="width: 60px; text-align: right; font-size: 0.85rem; color: var(--text-secondary);">${pct}%</div>
                </div>
            `;
        });
        html += '</div>';
        return html;
    },

    generatePowerDistributionHTML(dist) {
        let html = '<div class="power-bar">';
        for (let i = 1; i <= 11; i++) {
            const count = dist[i];
            html += `<div class="power-segment ${count > 0 ? 'has-brawlers' : ''}" title="Power ${i}: ${count} brawlers">
                P${i}<br>${count}
            </div>`;
        }
        html += '</div>';
        return html;
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
        const brawlers = [...this.currentPlayer.brawlers].sort((a, b) => b.trophies - a.trophies);

        let html = '<table class="data-table"><thead><tr>';
        html += '<th>Brawler</th><th>Power</th><th>Trophies</th>';
        html += '<th>Gadgets</th><th>Star Powers</th><th>Hypercharge</th>';
        html += '<th>Gears</th><th>Buffies</th></tr></thead><tbody>';

        brawlers.forEach(b => {
            const brawlerRef = this.brawlersRef.find(br => br.name === b.name);
            if (!brawlerRef) return;

            // Get item names
            const gadget1 = this.getItemName(brawlerRef.gadgets || [], b.gadget_ids[0]);
            const gadget2 = this.getItemName(brawlerRef.gadgets || [], b.gadget_ids[1]);
            const sp1 = this.getItemName(brawlerRef.starPowers || [], b.star_power_ids[0]);
            const sp2 = this.getItemName(brawlerRef.starPowers || [], b.star_power_ids[1]);
            const hc = this.getItemName(brawlerRef.hyperCharges || [], b.hyper_charge_ids[0]);

            html += '<tr>';
            html += `<td><strong>${b.name}</strong></td>`;
            html += `<td>P${b.power}</td>`;
            html += `<td>${b.trophies}</td>`;
            html += `<td>${this.formatItems([gadget1, gadget2])}</td>`;
            html += `<td>${this.formatItems([sp1, sp2])}</td>`;
            html += `<td>${hc || '<span class="badge missing">Missing</span>'}</td>`;
            html += `<td>${b.gear_ids.length} gears</td>`;
            html += `<td>${b.buffies ? '✓' : '✗'}</td>`;
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
