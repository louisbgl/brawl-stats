/**
 * OverviewLeaderboard - Renders club leaderboard for Overview tab
 *
 * Dependencies: common.js (GameConfig)
 */

const OverviewLeaderboard = {
    /**
     * Render leaderboard table with category filters (initial render)
     * @param {HTMLElement} container - Container element for leaderboard
     * @param {Object} leaderboards - Leaderboards object from club-summary
     * @param {string} activeCategory - Currently active leaderboard category
     * @param {Function} onCategoryChange - Callback when category changes
     * @returns {void}
     */
    render(container, leaderboards, activeCategory = 'trophies', onCategoryChange) {
        const categories = Object.keys(GameConfig.LEADERBOARD_CATEGORIES);

        // Build category filter buttons
        const categoryButtons = categories.map(cat => {
            const isActive = cat === activeCategory;
            const label = GameConfig.LEADERBOARD_CATEGORIES[cat];
            return `<button class="lb-category-btn ${isActive ? 'active' : ''}" data-category="${cat}">${label}</button>`;
        }).join('');

        // Build initial leaderboard
        const leaderboardHTML = this.buildLeaderboardHTML(leaderboards[activeCategory], activeCategory);

        // Render HTML (only done once)
        container.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <div class="lb-category-controls">
                    ${categoryButtons}
                </div>
            </div>
            <div class="lb-content">
                ${leaderboardHTML}
            </div>
        `;

        // Setup category button handlers
        container.querySelectorAll('.lb-category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                const currentActive = container.querySelector('.lb-category-btn.active')?.dataset.category;

                if (category !== currentActive) {
                    // Update active button
                    container.querySelectorAll('.lb-category-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    // Update leaderboard content only
                    this.updateLeaderboard(container, leaderboards, category);

                    // Trigger callback
                    if (onCategoryChange) {
                        onCategoryChange(category);
                    }
                }
            });
        });
    },

    /**
     * Build leaderboard HTML (podium + rest)
     */
    buildLeaderboardHTML(leaderboardData, category) {
        const data = leaderboardData || [];

        // For ranked_best: reverse so higher numbers (better) shown first
        const sortedData = category === 'ranked_best' ? [...data].reverse() : data;

        if (sortedData.length === 0) {
            return '<div class="loading">No data available</div>';
        }

        // Top 3 for podium (reorder as 2nd, 1st, 3rd)
        const top3 = sortedData.slice(0, 3);
        const podiumOrder = [
            top3[1] || null, // 2nd place (left)
            top3[0] || null, // 1st place (center)
            top3[2] || null  // 3rd place (right)
        ];

        const podiumHTML = podiumOrder.map((player, visualIdx) => {
            if (!player) return '<div class="lb-podium-empty"></div>';

            const actualRank = visualIdx === 1 ? 1 : visualIdx === 0 ? 2 : 3;
            const formattedValue = GameConfig.formatLeaderboardValue(category, player.value);

            // Get value color for ranked_best
            let valueStyle = '';
            if (category === 'ranked_best') {
                const color = GameConfig.getRankColor(player.value);
                if (color.startsWith('linear-gradient')) {
                    valueStyle = `style="background: ${color}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"`;
                } else {
                    valueStyle = `style="color: ${color};"`;
                }
            }

            return `
                <div class="lb-podium-place lb-podium-rank-${actualRank}">
                    <div class="lb-podium-rank">#${actualRank}</div>
                    <div class="lb-podium-player">${player.name}</div>
                    <div class="lb-podium-value" ${valueStyle}>${formattedValue}</div>
                </div>
            `;
        }).join('');

        // Remaining players (4th+)
        const remaining = sortedData.slice(3);
        const remainingHTML = remaining.length > 0 ? `
            <div class="lb-rest">
                ${remaining.map((player, idx) => {
                    const formattedValue = GameConfig.formatLeaderboardValue(category, player.value);

                    let valueStyle = '';
                    if (category === 'ranked_best') {
                        const color = GameConfig.getRankColor(player.value);
                        if (color.startsWith('linear-gradient')) {
                            valueStyle = `style="background: ${color}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"`;
                        } else {
                            valueStyle = `style="color: ${color};"`;
                        }
                    }

                    return `
                        <div class="lb-rest-item">
                            <div class="lb-rest-rank">${idx + 4}</div>
                            <div class="lb-rest-player">${player.name}</div>
                            <div class="lb-rest-value" ${valueStyle}>${formattedValue}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        ` : '';

        return `
            <div class="lb-podium-display">
                ${podiumHTML}
            </div>
            ${remainingHTML}
        `;
    },

    /**
     * Update leaderboard content without re-rendering everything
     */
    updateLeaderboard(container, leaderboards, category) {
        const content = container.querySelector('.lb-content');

        if (content) {
            content.innerHTML = this.buildLeaderboardHTML(leaderboards[category], category);
        }
    }
};
