// Main application logic

async function init() {
    try {
        await DataManager.init();
        await BattlelogDataManager.init();

        // Update last update time
        const updateTime = new Date(DataManager.latestData.timestamp);
        document.getElementById('lastUpdate').textContent =
            `Last updated: ${updateTime.toLocaleString()}`;

        // Setup tab switching
        setupTabs();

        // Populate player selector
        populatePlayerSelect();

        // Populate trophy brawler selector
        populateTrophyBrawlerSelect();

        // Create initial charts
        ChartsManager.createTrophyTimeline(); // Club Overview chart
        ChartsManager.createBrawlerTrophyTimeline(); // Timelines tab - overall by default
        ChartsManager.createWinsTimeline(); // Timelines tab - overall by default
        ChartsManager.createCollectionTimeline();
        ChartsManager.createMaxedTimeline();
        ChartsManager.createPrestigeTimeline();

        // Setup club quick stats and leaderboards
        displayClubQuickStats();
        displayClubLeaderboards();

    } catch (error) {
        console.error('Failed to initialize:', error);
        document.body.innerHTML =
            '<div style="padding: 40px; text-align: center; color: var(--accent-red);">Failed to load data. Please check console for errors.</div>';
    }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active from all
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));

            // Add active to clicked
            tab.classList.add('active');
            const targetTab = tab.dataset.tab;
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

function populatePlayerSelect() {
    const select = document.getElementById('playerSelect');
    select.innerHTML = '<option value="">-- Select a player --</option>';

    DataManager.getAllPlayers().forEach((player, idx) => {
        const option = document.createElement('option');
        option.value = JSON.stringify({ clubIndex: player.clubIndex, playerIndex: player.playerIndex });
        option.textContent = `${player.name} (${player.tag})`;
        select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
        if (e.target.value) {
            const { clubIndex, playerIndex } = JSON.parse(e.target.value);
            PlayerStatsManager.displayPlayerStats(clubIndex, playerIndex);
        } else {
            document.getElementById('playerStatsContainer').innerHTML =
                '<div class="loading">Select a player to view detailed stats</div>';
        }
    });
}

function populateTrophyBrawlerSelect() {
    const select = document.getElementById('trophyBrawlerSelect');
    const brawlers = DataManager.getAllBrawlerNames();

    brawlers.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
        if (e.target.value) {
            ChartsManager.createBrawlerTrophyTimeline(e.target.value);
        } else {
            ChartsManager.createTrophyTimeline();
        }
    });

    // Setup gamemode selector
    document.getElementById('gamemodeSelect').addEventListener('change', (e) => {
        ChartsManager.createWinsTimeline(e.target.value);
    });
}

function displayClubQuickStats() {
    const players = DataManager.getAllPlayers();
    const totalTrophies = players.reduce((sum, p) => sum + p.trophies, 0);
    const avgTrophies = Math.round(totalTrophies / players.length);

    // Count prestige brawlers (1000+ trophies) across all players
    const prestigeBrawlers = players.reduce((sum, p) => {
        return sum + p.brawlers.filter(b => b.trophies >= 1000).length;
    }, 0);

    // Battlelog stats
    const totalBattles = BattlelogDataManager.getTotalBattleCount();
    const clubAvgWr = BattlelogAnalytics.getClubAverageWinRate();
    const favoriteMode = BattlelogAnalytics.getClubMostPlayedMode();
    const mostActive = BattlelogAnalytics.getMostActivePlayer(7);
    const bestWr = BattlelogAnalytics.getBestWinRatePlayer(7, 10);

    let html = `
        <div class="stat-box">
            <div class="stat-label">Total Members</div>
            <div class="stat-value highlight-blue">${players.length}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Combined Trophies</div>
            <div class="stat-value highlight-purple">${totalTrophies.toLocaleString()}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Prestige Brawlers</div>
            <div class="stat-value highlight-orange">${prestigeBrawlers}</div>
        </div>
    `;

    // Add battlelog stats if data is available
    if (BattlelogDataManager.isLoaded && totalBattles > 0) {
        html += `
            <div class="stat-box">
                <div class="stat-label">Total Battles</div>
                <div class="stat-value highlight-blue">${totalBattles.toLocaleString()}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Club Avg Win Rate</div>
                <div class="stat-value highlight-green">${clubAvgWr.toFixed(1)}%</div>
            </div>
        `;

        if (favoriteMode) {
            html += `
                <div class="stat-box">
                    <div class="stat-label">Favorite Mode</div>
                    <div class="stat-value highlight-purple">${favoriteMode.mode}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">${favoriteMode.percentage.toFixed(1)}% of games</div>
                </div>
            `;
        }

        if (mostActive) {
            html += `
                <div class="stat-box">
                    <div class="stat-label">Most Active (7d)</div>
                    <div class="stat-value highlight-orange">${mostActive.name}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">${mostActive.battleCount} games</div>
                </div>
            `;
        }

        if (bestWr) {
            html += `
                <div class="stat-box">
                    <div class="stat-label">Best WR (7d)</div>
                    <div class="stat-value highlight-green">${bestWr.name}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">${bestWr.winRate.toFixed(1)}%</div>
                </div>
            `;
        }
    }

    document.getElementById('clubQuickStats').innerHTML = html;
}

function displayClubLeaderboards() {
    const container = document.getElementById('clubLeaderboards');
    if (!container) return;

    if (!BattlelogDataManager.isLoaded || BattlelogDataManager.getTotalBattleCount() === 0) {
        container.innerHTML = '<div class="loading">No battlelog data available yet</div>';
        return;
    }

    const players = DataManager.getAllPlayers();

    // Calculate leaderboard stats
    const grindKing = players
        .map(p => ({
            name: p.name,
            battles: BattlelogDataManager.getPlayerBattleCount(p.tag)
        }))
        .sort((a, b) => b.battles - a.battles)[0];

    const bestOverallWr = BattlelogAnalytics.getBestOverallWinRatePlayer(20);
    const starPlayer = BattlelogAnalytics.getTopStarPlayer();
    const hotStreak = BattlelogAnalytics.getLongestCurrentStreak();

    const html = `
        <div class="leaderboard-grid">
            <div class="leaderboard-item">
                <div class="leaderboard-icon">👑</div>
                <div class="leaderboard-title">Grind King</div>
                <div class="leaderboard-player">${grindKing?.name || 'N/A'}</div>
                <div class="leaderboard-stat">${grindKing?.battles.toLocaleString() || 0} battles</div>
            </div>

            <div class="leaderboard-item">
                <div class="leaderboard-icon">🏆</div>
                <div class="leaderboard-title">Best Win Rate</div>
                <div class="leaderboard-player">${bestOverallWr?.name || 'N/A'}</div>
                <div class="leaderboard-stat">${bestOverallWr ? `${bestOverallWr.winRate.toFixed(1)}%` : 'N/A'}</div>
            </div>

            <div class="leaderboard-item">
                <div class="leaderboard-icon">⭐</div>
                <div class="leaderboard-title">Star Player</div>
                <div class="leaderboard-player">${starPlayer?.name || 'N/A'}</div>
                <div class="leaderboard-stat">${starPlayer?.starPlayerCount || 0} MVPs</div>
            </div>

            <div class="leaderboard-item">
                <div class="leaderboard-icon">🔥</div>
                <div class="leaderboard-title">Hot Streak</div>
                <div class="leaderboard-player">${hotStreak?.name || 'N/A'}</div>
                <div class="leaderboard-stat">${hotStreak ? `${hotStreak.streak} wins` : 'N/A'}</div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Initialize on page load
init();
