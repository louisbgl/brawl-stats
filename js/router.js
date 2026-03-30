// Router module - handles hash-based URL routing for tabs

const Router = {
    routes: {
        'overview': () => {
            Router.switchToTab('overview');
        },
        'player': (tag) => {
            Router.switchToTab('player');
            if (tag) {
                // Find and select player by tag
                Router.selectPlayerByTag(tag);
            }
        },
        'timelines': () => {
            Router.switchToTab('timelines');
        },
        'achievements': (playerFilter, dateRange, ...types) => {
            Router.switchToTab('achievements');
            if (playerFilter || dateRange || types.length > 0) {
                // Apply filters from URL
                AchievementsManager.applyFiltersFromURL(playerFilter, dateRange, types);
            }
        },
        'battles': (playerFilter, modeFilter, resultFilter) => {
            Router.switchToTab('battles');
            if (playerFilter || modeFilter || resultFilter) {
                // Apply filters from URL
                BattlesManager.applyFiltersFromURL(playerFilter, modeFilter, resultFilter);
            }
        }
    },

    currentTab: null,

    navigate(path) {
        // Navigate to a new route (updates URL and triggers route handler)
        window.location.hash = '#' + path;
    },

    switchToTab(tabName) {
        // Switch to a tab without triggering infinite loops
        if (this.currentTab === tabName) return;

        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');

        // Remove active from all
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));

        // Add active to target
        const targetTabButton = document.querySelector(`.tab[data-tab="${tabName}"]`);
        const targetTabContent = document.getElementById(tabName);

        if (targetTabButton && targetTabContent) {
            targetTabButton.classList.add('active');
            targetTabContent.classList.add('active');
            this.currentTab = tabName;

            // Initialize tab content if needed
            this.initializeTabContent(tabName);
        }
    },

    async initializeTabContent(tabName) {
        // Lazy initialize tabs when they're first viewed
        if (tabName === 'achievements') {
            // Ensure achievements data is loaded before initializing
            await DataManager.ensureAchievementsLoaded();
            AchievementsManager.init();
        } else if (tabName === 'battles') {
            // Ensure battlelog data is loaded before initializing
            await BattlelogDataManager.ensureLoaded();
            BattlesManager.init();
        } else if (tabName === 'timelines') {
            // Ensure historical data is loaded before creating charts
            await DataManager.ensureHistoricalLoaded();

            // Create timeline charts if not already created
            if (!ChartsManager.charts.trophyTimeline) {
                ChartsManager.createBrawlerTrophyTimeline();
            }
            if (!ChartsManager.charts.wins) {
                ChartsManager.createWinsTimeline();
            }
            if (!ChartsManager.charts.collection) {
                ChartsManager.createCollectionTimeline();
            }
            if (!ChartsManager.charts.maxed) {
                ChartsManager.createMaxedTimeline();
            }
            if (!ChartsManager.charts.prestige) {
                ChartsManager.createPrestigeTimeline();
            }
            if (!ChartsManager.charts.activityTimeline) {
                ChartsManager.createActivityTimeline();
            }
            if (!ChartsManager.charts.modePopularity) {
                ChartsManager.createModePopularityTimeline();
            }
        } else if (tabName === 'player') {
            // Player stats are loaded when player is selected via dropdown
            // No initialization needed here
        }
    },

    selectPlayerByTag(tag) {
        // Find player in selector and trigger selection
        const select = document.getElementById('playerSelect');
        if (!select) return;

        // Find option with matching tag
        for (let i = 0; i < select.options.length; i++) {
            const option = select.options[i];
            if (option.value) {
                try {
                    const data = JSON.parse(option.value);
                    const player = DataManager.getPlayer(data.clubIndex, data.playerIndex);
                    if (player && player.tag === tag) {
                        select.selectedIndex = i;
                        // Trigger change event to load player stats
                        select.dispatchEvent(new Event('change'));
                        break;
                    }
                } catch (e) {
                    // Invalid option value
                }
            }
        }
    },

    handleRoute() {
        // Parse current hash and execute corresponding route
        let hash = window.location.hash;

        // Default to overview if no hash
        if (!hash || hash === '#' || hash === '#/') {
            hash = '#/overview';
            window.location.hash = hash;
            return;
        }

        // Remove leading '#/'
        const path = hash.slice(2);
        const [route, ...params] = path.split('/');

        if (this.routes[route]) {
            this.routes[route](...params);
        } else {
            // Unknown route, redirect to overview
            this.navigate('/overview');
        }
    },

    updateURL(tabName, params = []) {
        // Update URL without triggering route handler
        const newPath = '/' + tabName + (params.length ? '/' + params.join('/') : '');
        const currentPath = window.location.hash.slice(1);

        if (currentPath !== newPath) {
            // Use replaceState to avoid adding to history on programmatic changes
            history.replaceState(null, '', '#' + newPath);
        }
    },

    init() {
        // Setup routing on page load
        window.addEventListener('hashchange', () => this.handleRoute());

        // Setup tab click handlers to update URL
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = tab.dataset.tab;
                this.navigate('/' + tabName);
            });
        });

        // Setup player select to update URL
        const playerSelect = document.getElementById('playerSelect');
        if (playerSelect) {
            playerSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    try {
                        const { clubIndex, playerIndex } = JSON.parse(e.target.value);
                        const player = DataManager.getPlayer(clubIndex, playerIndex);
                        if (player) {
                            this.updateURL('player', [player.tag]);
                        }
                    } catch (err) {
                        // Invalid JSON, ignore
                        console.warn('Invalid player select value:', e.target.value);
                    }
                }
            });
        }

        // Handle initial route
        this.handleRoute();
    }
};
