// Main application logic

async function init() {
    try {
        await DataManager.init();

        // Update last update time
        const updateTime = new Date(DataManager.latestData.timestamp);
        document.getElementById('lastUpdate').textContent =
            `Last updated: ${updateTime.toLocaleString()}`;

        // Setup tab switching
        setupTabs();

        // Populate player selector
        populatePlayerSelect();

        // Populate brawler selector
        populateBrawlerSelect();

        // Create initial charts
        ChartsManager.createTrophyTimeline();
        ChartsManager.createWinsTimeline();
        ChartsManager.createCollectionTimeline();
        ChartsManager.createMaxedTimeline();
        ChartsManager.createPrestigeTimeline();

        // Setup club quick stats
        displayClubQuickStats();

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

function populateBrawlerSelect() {
    const select = document.getElementById('brawlerSelect');
    const brawlers = DataManager.getAllBrawlerNames();

    brawlers.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
        ChartsManager.createBrawlerTrophyTimeline(e.target.value);
    });
}

function displayClubQuickStats() {
    const players = DataManager.getAllPlayers();
    const totalTrophies = players.reduce((sum, p) => sum + p.trophies, 0);
    const totalBrawlers = players.reduce((sum, p) => sum + p.brawlers.length, 0);
    const avgTrophies = Math.round(totalTrophies / players.length);

    const html = `
        <div class="stat-box">
            <div class="stat-label">Total Members</div>
            <div class="stat-value highlight-blue">${players.length}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Combined Trophies</div>
            <div class="stat-value highlight-purple">${totalTrophies.toLocaleString()}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Avg Trophies</div>
            <div class="stat-value highlight-green">${avgTrophies.toLocaleString()}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">Total Brawlers</div>
            <div class="stat-value highlight-orange">${totalBrawlers}</div>
        </div>
    `;

    document.getElementById('clubQuickStats').innerHTML = html;
}

// Initialize on page load
init();
