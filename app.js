let latestData = null;
let historicalData = [];

// Load all historical data
async function loadData() {
    try {
        const response = await fetch('data/latest.json');
        latestData = await response.json();

        // Update last update time
        const updateTime = new Date(latestData.timestamp);
        document.getElementById('lastUpdate').textContent =
            `Last updated: ${updateTime.toLocaleString()}`;

        // Load all historical snapshots
        await loadHistoricalData();

        // Populate player dropdown
        populatePlayerSelect();

        // Create trophy chart
        createTrophyChart();
    } catch (error) {
        document.getElementById('playerStats').innerHTML =
            '<div class="error">Failed to load data. Make sure you have run the data collection script.</div>';
    }
}

async function loadHistoricalData() {
    // Try to load all date-based JSON files
    const dates = [];
    const startDate = new Date('2026-03-14T00:00:00+01:00'); // CET timezone
    const today = new Date();

    // Generate dates in YYYY-MM-DD format
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
        // Format as YYYY-MM-DD
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
    }

    // Try to load each file
    for (const date of dates) {
        try {
            const response = await fetch(`data/${date}.json`);
            if (response.ok) {
                const data = await response.json();
                historicalData.push(data);
                console.log(`Loaded ${date}.json`);
            }
        } catch (error) {
            console.log(`Could not load ${date}.json`);
        }
    }

    // Sort by date
    historicalData.sort((a, b) => new Date(a.date) - new Date(b.date));
    console.log(`Total snapshots loaded: ${historicalData.length}`);
}

function createTrophyChart() {
    if (historicalData.length === 0) {
        document.getElementById('trophyChart').parentElement.innerHTML =
            '<div class="loading">No historical data yet. Run the script daily to build up timeline data!</div>';
        return;
    }

    // Get unique player tags from latest data
    const playerMap = new Map();
    latestData.clubs.forEach(club => {
        club.members.forEach(player => {
            playerMap.set(player.tag, player.name);
        });
    });

    // Get dates for x-axis
    const dates = historicalData.map(snapshot => snapshot.date);

    // Create a dataset for each player
    const datasets = [];
    const colors = [
        'rgba(102, 126, 234, 1)',
        'rgba(118, 75, 162, 1)',
        'rgba(244, 143, 177, 1)',
        'rgba(255, 167, 38, 1)',
        'rgba(102, 187, 106, 1)',
        'rgba(41, 182, 246, 1)',
        'rgba(171, 71, 188, 1)'
    ];

    let colorIndex = 0;
    playerMap.forEach((name, tag) => {
        const trophyData = historicalData.map(snapshot => {
            // Find this player in this snapshot
            let trophies = null;
            snapshot.clubs.forEach(club => {
                const player = club.members.find(p => p.tag === tag);
                if (player) {
                    trophies = player.trophies;
                }
            });
            return trophies;
        });

        datasets.push({
            label: name,
            data: trophyData,
            borderColor: colors[colorIndex % colors.length],
            backgroundColor: colors[colorIndex % colors.length].replace('1)', '0.1)'),
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: colors[colorIndex % colors.length],
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            fill: false
        });
        colorIndex++;
    });

    // Calculate min/max for better scaling
    const allTrophies = datasets.flatMap(d => d.data.filter(v => v !== null));
    const minTrophies = Math.min(...allTrophies);
    const maxTrophies = Math.max(...allTrophies);
    const range = maxTrophies - minTrophies;
    const padding = Math.max(range * 0.1, 1000); // At least 1000 trophy padding

    const ctx = document.getElementById('trophyChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    min: Math.floor((minTrophies - padding) / 1000) * 1000,
                    max: Math.ceil((maxTrophies + padding) / 1000) * 1000,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        },
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 13
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 13
                    },
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y.toLocaleString() + ' 🏆';
                        }
                    }
                }
            }
        }
    });
}

function populatePlayerSelect() {
    const select = document.getElementById('playerSelect');
    select.innerHTML = '<option value="">-- Choose a player --</option>';

    // Get all players from all clubs
    latestData.clubs.forEach(club => {
        club.members.forEach((player, index) => {
            const option = document.createElement('option');
            option.value = JSON.stringify({ clubIndex: latestData.clubs.indexOf(club), playerIndex: index });
            option.textContent = `${player.name} (${player.tag})`;
            select.appendChild(option);
        });
    });
}

function displayPlayerStats(clubIndex, playerIndex) {
    const player = latestData.clubs[clubIndex].members[playerIndex];
    const statsDiv = document.getElementById('playerStats');

    // Calculate some stats
    const totalBrawlers = player.brawlers.length;
    const maxBrawlers = 101; // Update this if needed
    const collectionProgress = (totalBrawlers / maxBrawlers * 100).toFixed(1);

    const power11Brawlers = player.brawlers.filter(b => b.power === 11).length;
    const avgTrophies = totalBrawlers > 0
        ? Math.round(player.brawlers.reduce((sum, b) => sum + b.trophies, 0) / totalBrawlers)
        : 0;

    const totalWins = player.victories_3v3 + player.solo_victories + player.duo_victories;

    statsDiv.innerHTML = `
        <div class="player-info">
            <div class="player-name">${player.name}</div>
            <div class="player-tag">${player.tag}</div>
        </div>

        <div class="stats-grid">
            <div class="stat-box">
                <div class="stat-label">🏆 Trophies</div>
                <div class="stat-value">${player.trophies.toLocaleString()}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">⭐ Highest</div>
                <div class="stat-value">${player.highest_trophies.toLocaleString()}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">📊 Level</div>
                <div class="stat-value">${player.exp_level}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">✨ Total Wins</div>
                <div class="stat-value">${totalWins.toLocaleString()}</div>
            </div>
        </div>

        <div class="brawler-summary">
            <h3>Brawler Collection</h3>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${collectionProgress}%">
                    ${totalBrawlers} / ${maxBrawlers} (${collectionProgress}%)
                </div>
            </div>

            <div class="stats-grid" style="margin-top: 20px;">
                <div class="stat-box">
                    <div class="stat-label">💪 Power 11</div>
                    <div class="stat-value">${power11Brawlers}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">📈 Avg Trophies</div>
                    <div class="stat-value">${avgTrophies}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">🎮 3v3 Wins</div>
                    <div class="stat-value">${player.victories_3v3.toLocaleString()}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">👤 Solo Wins</div>
                    <div class="stat-value">${player.solo_victories.toLocaleString()}</div>
                </div>
            </div>
        </div>
    `;
}

// Event listeners
document.getElementById('playerSelect').addEventListener('change', (e) => {
    if (e.target.value) {
        const { clubIndex, playerIndex } = JSON.parse(e.target.value);
        displayPlayerStats(clubIndex, playerIndex);
    } else {
        document.getElementById('playerStats').innerHTML =
            '<div class="loading">Select a player to view stats</div>';
    }
});

// Load data on page load
loadData();
