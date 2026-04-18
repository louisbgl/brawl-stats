// Main application logic

async function init() {
    try {
        // PHASE 1: Load critical data only (blocking)
        await DataManager.init(); // Now only loads latest.json + brawlers.json

        // Update last update times
        updateLastUpdatedDisplay();

        // Setup UI components
        setupTabs();
        populatePlayerSelect();
        populateTrophyBrawlerSelect();

        // Initialize Overview tab (first visible tab)
        await initOverviewTab();

        // PHASE 2: Start background loading (non-blocking)
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => {
                startBackgroundLoading();
            });
        } else {
            // Fallback for browsers that don't support requestIdleCallback
            setTimeout(() => {
                startBackgroundLoading();
            }, 100);
        }

        // PHASE 3: Initialize router (handles URL-based navigation)
        Router.init();

    } catch (error) {
        console.error('Failed to initialize:', error);
        document.body.innerHTML =
            '<div style="padding: 40px; text-align: center; color: var(--accent-red);">Failed to load data. Please check console for errors.</div>';
    }
}

async function initOverviewTab() {
    // Display quick stats (without battlelog data initially)
    displayClubQuickStats();
    displayClubLeaderboards();

    // Trophy chart needs historical data, which will be loaded in background
    // Chart will be created once data is available
}

function startBackgroundLoading() {
    DataManager.initBackground();

    // Create trophy chart once historical data is loaded
    DataManager.loadingPromises.historical.then(() => {
        ChartsManager.createTrophyTimeline();
    });

    BattlelogDataManager.init().then(() => {
        // Update overview stats with battlelog metrics now that data is available
        displayClubQuickStats();
        displayClubLeaderboards();
        // Update battlelog timestamp in header
        updateLastUpdatedDisplay();
    });
}

function updateLastUpdatedDisplay() {
    // Display snapshot timestamp
    const snapshotTime = new Date(DataManager.latestData.timestamp);
    document.getElementById('snapshotUpdate').textContent =
        `Snapshots: ${snapshotTime.toLocaleString()}`;

    // Display battlelog timestamp if loaded
    const battlelogTime = BattlelogDataManager.getLastCollectionTime();
    const battlelogEl = document.getElementById('battlelogUpdate');
    if (battlelogTime) {
        const battlelogDate = new Date(battlelogTime);
        battlelogEl.textContent = `Battlelogs: ${battlelogDate.toLocaleString()}`;
    } else {
        battlelogEl.textContent = 'Battlelogs: Loading...';
    }
}

function setupTabs() {
    // Tab switching is now handled by Router
    // This function kept for potential future tab-related setup
    // (event listeners for tabs are set up in Router.init)
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

    let currentTrophyView = 'daily';
    let currentBrawler = '';

    select.addEventListener('change', (e) => {
        currentBrawler = e.target.value;
        if (currentBrawler) {
            ChartsManager.createBrawlerTrophyTimeline(currentBrawler, currentTrophyView);
        } else {
            ChartsManager.createBrawlerTrophyTimeline('', currentTrophyView);
        }
    });

    // Setup trophy timeline view toggle
    const trophyViewDaily = document.getElementById('trophyViewDaily');
    const trophyViewBattles = document.getElementById('trophyViewBattles');
    if (trophyViewDaily && trophyViewBattles) {
        trophyViewDaily.addEventListener('click', () => {
            if (currentTrophyView === 'daily') return;
            currentTrophyView = 'daily';
            trophyViewDaily.classList.add('active');
            trophyViewBattles.classList.remove('active');
            ChartsManager.createBrawlerTrophyTimeline(currentBrawler, 'daily');
        });

        trophyViewBattles.addEventListener('click', () => {
            if (currentTrophyView === 'battles') return;
            currentTrophyView = 'battles';
            trophyViewBattles.classList.add('active');
            trophyViewDaily.classList.remove('active');
            ChartsManager.createBrawlerTrophyTimeline(currentBrawler, 'battles');
        });
    }

    // Setup gamemode selector
    document.getElementById('gamemodeSelect').addEventListener('change', (e) => {
        ChartsManager.createWinsTimeline(e.target.value);
    });

    // Setup activity timeline range selector
    const activityRangeSelect = document.getElementById('activityTimelineRangeSelect');
    if (activityRangeSelect) {
        activityRangeSelect.addEventListener('change', (e) => {
            ChartsManager.createActivityTimeline(e.target.value);
        });
    }
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
                    <div class="stat-value highlight-purple">${GameConstants.getModeName(favoriteMode.mode)}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">${favoriteMode.percentage.toFixed(1)}% of games</div>
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

    // === TOTAL BATTLES LEADERBOARD ===
    const battlesRanking = players
        .map(p => ({
            name: p.name,
            value: BattlelogDataManager.getPlayerBattleCount(p.tag),
            formattedValue: BattlelogDataManager.getPlayerBattleCount(p.tag).toLocaleString()
        }))
        .sort((a, b) => b.value - a.value);

    // === WIN RATE LEADERBOARD (show all players, note if < 20 battles) ===
    const winRateRanking = players
        .map(p => {
            const battleCount = BattlelogDataManager.getPlayerBattleCount(p.tag);
            const wr = BattlelogAnalytics.getWinRate(p.tag);

            return {
                name: p.name,
                value: wr.winRate,
                formattedValue: battleCount < 20 ? `${wr.winRate.toFixed(1)}%*` : `${wr.winRate.toFixed(1)}%`
            };
        })
        .sort((a, b) => b.value - a.value);

    // === STAR PLAYER LEADERBOARD ===
    const starPlayerRanking = players
        .map(p => {
            const starPlayerCount = BattlelogAnalytics.getStarPlayerCount(p.tag);
            return {
                name: p.name,
                value: starPlayerCount,
                formattedValue: starPlayerCount.toString()
            };
        })
        .sort((a, b) => b.value - a.value);

    // === MAXED BRAWLERS LEADERBOARD ===
    const maxedRanking = players
        .map(p => ({
            name: p.name,
            value: p.brawlers.filter(b => CalculationHelpers.isMaxedBrawler(b)).length,
            formattedValue: p.brawlers.filter(b => CalculationHelpers.isMaxedBrawler(b)).length.toString()
        }))
        .sort((a, b) => b.value - a.value);

    // === DYNAMIC PRESTIGE LEADERBOARDS (P1, P2, P3, etc.) ===
    // First, find the max prestige level across all players
    const maxPrestigeLevel = Math.max(
        ...players.flatMap(p =>
            p.brawlers.map(b => CalculationHelpers.getPrestigeLevel(b.trophies))
        )
    );

    // Create rankings for each prestige level (1 to maxPrestigeLevel)
    const prestigeLeaderboards = [];
    const prestigeEmojis = ['💎', '💠', '🔷', '🔹', '✨', '⭐', '🌟', '💫', '⚡', '🏆'];

    for (let level = 1; level <= maxPrestigeLevel; level++) {
        // Count brawlers at this prestige level for each player
        const ranking = players
            .map(p => {
                const count = p.brawlers.filter(b => {
                    const prestigeLevel = CalculationHelpers.getPrestigeLevel(b.trophies);
                    return prestigeLevel === level;
                }).length;

                return {
                    name: p.name,
                    value: count,
                    formattedValue: count.toString()
                };
            })
            .sort((a, b) => b.value - a.value);

        const emoji = prestigeEmojis[level - 1] || '💎';
        const accentColor = level === 1 ? 'var(--accent-purple)' :
                          level === 2 ? 'var(--accent-red)' :
                          'var(--accent-orange)';

        prestigeLeaderboards.push(
            ViewHelpers.createPodiumLeaderboard(
                `Prestige ${level} (${level * 1000}+ trophies)`,
                emoji,
                ranking,
                accentColor
            )
        );
    }

    const html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">
            ${ViewHelpers.createPodiumLeaderboard('Total Battles', '👑', battlesRanking, 'var(--accent-blue)')}
            ${ViewHelpers.createPodiumLeaderboard('Win Rate', '📊', winRateRanking, 'var(--accent-green)')}
            ${ViewHelpers.createPodiumLeaderboard('Star Player MVPs', '⭐', starPlayerRanking, 'var(--accent-purple)')}
            ${ViewHelpers.createPodiumLeaderboard('Maxed Brawlers', '✨', maxedRanking, 'var(--accent-green)')}
            ${prestigeLeaderboards.join('')}
        </div>
    `;

    container.innerHTML = html;
}

// Initialize on page load
init();
