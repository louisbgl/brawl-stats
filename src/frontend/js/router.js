/**
 * Simple hash-based router for tab navigation
 */

const Router = {
    init() {
        // Handle initial load
        this.handleRoute();

        // Listen for hash changes
        window.addEventListener('hashchange', () => {
            this.handleRoute();
        });
    },

    handleRoute() {
        const hash = window.location.hash.slice(1); // Remove #
        const parts = hash.split('/');
        const tab = parts[0] || 'overview'; // Default to overview
        const filters = parts.slice(1); // Everything after tab name

        this.switchToTab(tab, filters);
    },

    switchToTab(tabName, filters = []) {
        // Remove active class from all tabs and contents
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

        // Add active class to target tab
        const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(tabName);

        if (tabButton && tabContent) {
            tabButton.classList.add('active');
            tabContent.classList.add('active');

            // Trigger tab-specific rendering with filters
            this.renderTab(tabName, filters);
        }
    },

    renderTab(tabName, filters = []) {
        switch(tabName) {
            case 'overview':
                if (typeof OverviewManager !== 'undefined') {
                    OverviewManager.render();
                }
                break;
            case 'player':
                console.log('Players tab - not implemented yet');
                break;
            case 'achievements':
                if (typeof AchievementsManager !== 'undefined') {
                    AchievementsManager.render(filters);
                }
                break;
            case 'battles':
                if (typeof BattlesManager !== 'undefined') {
                    BattlesManager.render(filters);
                }
                break;
        }
    },

    updateURL(tab) {
        window.location.hash = tab;
    }
};
