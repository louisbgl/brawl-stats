// Achievements module - displays player milestone timeline

const AchievementsManager = {
    achievements: [],
    filteredAchievements: [],
    currentFilters: {
        player: 'all',
        types: new Set(['new_brawler', 'maxed_brawler', 'gadget', 'star_power', 'hypercharge', 'prestige', 'trophy_milestone', 'first_prestige_level', 'total_prestiges']),
        dateRange: 'all' // 'all', '7days', '30days', 'custom'
    },

    init() {
        this.achievements = DataManager.achievementsData || [];
        this.applyFilters();
        this.render();
        this.setupFilterHandlers();
    },

    applyFilters() {
        let filtered = [...this.achievements];

        // Filter by player
        if (this.currentFilters.player !== 'all') {
            filtered = filtered.filter(a => a.player_tag === this.currentFilters.player);
        }

        // Filter by achievement types
        filtered = filtered.filter(a => this.currentFilters.types.has(a.type));

        // Filter by date range
        const now = new Date();
        if (this.currentFilters.dateRange === '7days') {
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            filtered = filtered.filter(a => new Date(a.date) >= sevenDaysAgo);
        } else if (this.currentFilters.dateRange === '30days') {
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            filtered = filtered.filter(a => new Date(a.date) >= thirtyDaysAgo);
        }

        // Sort by date descending (newest first)
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        this.filteredAchievements = filtered;
    },

    applyFiltersFromURL(playerFilter, dateRange, types) {
        // Apply filters from URL parameters
        if (playerFilter && playerFilter !== 'all') {
            this.currentFilters.player = playerFilter;
        }
        if (dateRange && ['all', '7days', '30days'].includes(dateRange)) {
            this.currentFilters.dateRange = dateRange;
        }
        if (types && types.length > 0) {
            // Parse types from URL (comma-separated or array)
            const typeArray = Array.isArray(types) ? types : types[0].split(',');
            this.currentFilters.types = new Set(typeArray.filter(t => t && t !== 'all'));
        }

        this.applyFilters();
        this.render();
        this.setupFilterHandlers();
    },

    updateURL() {
        // Update URL with current filters
        const params = [];

        // Player filter
        params.push(this.currentFilters.player !== 'all' ? this.currentFilters.player : 'all');

        // Date range filter
        params.push(this.currentFilters.dateRange);

        // Achievement types (comma-separated)
        if (this.currentFilters.types.size > 0) {
            params.push(Array.from(this.currentFilters.types).join(','));
        } else {
            params.push('none');
        }

        Router.updateURL('achievements', params);
    },

    render() {
        const container = document.getElementById('achievementsContainer');
        if (!container) return;

        container.innerHTML = `
            ${this.generateFiltersHTML()}
            ${this.generateFeedHTML()}
        `;
    },

    generateFiltersHTML() {
        const allPlayers = DataManager.getAllPlayers();
        const playerOptions = allPlayers.map(p =>
            `<option value="${p.tag}" ${this.currentFilters.player === p.tag ? 'selected' : ''}>${p.name}</option>`
        ).join('');

        return `
            <div class="filters-section">
                <h3>Filters</h3>
                <div class="filters-grid">
                    <div class="filter-group">
                        <label for="playerFilter">Player</label>
                        <select id="playerFilter" class="filter-select">
                            <option value="all">All Players</option>
                            ${playerOptions}
                        </select>
                    </div>

                    <div class="filter-group">
                        <label for="dateRangeFilter">Date Range</label>
                        <select id="dateRangeFilter" class="filter-select">
                            <option value="all" ${this.currentFilters.dateRange === 'all' ? 'selected' : ''}>All Time</option>
                            <option value="7days" ${this.currentFilters.dateRange === '7days' ? 'selected' : ''}>Last 7 Days</option>
                            <option value="30days" ${this.currentFilters.dateRange === '30days' ? 'selected' : ''}>Last 30 Days</option>
                        </select>
                    </div>

                    <div class="filter-group type-filters">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <label>Achievement Types</label>
                            <button id="selectAllTypes" class="filter-quick-btn">Select All</button>
                            <button id="deselectAllTypes" class="filter-quick-btn">Deselect All</button>
                        </div>
                        <div class="checkbox-group">
                            ${this.generateTypeCheckboxes()}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    generateTypeCheckboxes() {
        const types = [
            { id: 'trophy_milestone', label: 'Trophy Milestones', icon: '🏅' },
            { id: 'first_prestige_level', label: 'First Prestige Levels', icon: '⭐' },
            { id: 'total_prestiges', label: 'Total Prestiges', icon: '💎' },
            { id: 'prestige', label: 'Prestige', icon: '🏆' },
            { id: 'maxed_brawler', label: 'Maxed Brawlers', icon: '👑' },
            { id: 'new_brawler', label: 'New Brawlers', icon: '🎮' },
            { id: 'hypercharge', label: 'Hypercharges', icon: '<img src="assets/icons/hypercharge.webp" alt="Hypercharge" class="filter-icon-img">' },
            { id: 'star_power', label: 'Star Powers', icon: '<img src="assets/icons/starpower.webp" alt="Star Power" class="filter-icon-img">' },
            { id: 'gadget', label: 'Gadgets', icon: '<img src="assets/icons/gadget.webp" alt="Gadget" class="filter-icon-img">' }
        ];

        return types.map(type => `
            <label class="checkbox-label">
                <input type="checkbox"
                       id="filter_${type.id}"
                       value="${type.id}"
                       class="type-checkbox"
                       ${this.currentFilters.types.has(type.id) ? 'checked' : ''}>
                <span class="checkbox-label-content">${type.icon} ${type.label}</span>
            </label>
        `).join('');
    },

    generateFeedHTML() {
        if (this.filteredAchievements.length === 0) {
            return `
                <div class="achievement-feed">
                    <h3>Achievement Timeline</h3>
                    <div class="no-data">No achievements found with current filters</div>
                </div>
            `;
        }

        // Group by date
        const grouped = this.groupByDate(this.filteredAchievements);

        const feedHTML = Object.entries(grouped).map(([date, achievements]) => `
            <div class="date-group">
                <div class="date-header">${this.formatDateHeader(date)}</div>
                <div class="achievements-list">
                    ${achievements.map(a => this.generateAchievementCard(a)).join('')}
                </div>
            </div>
        `).join('');

        return `
            <div class="achievement-feed">
                <h3>Achievement Timeline (${this.filteredAchievements.length})</h3>
                ${feedHTML}
            </div>
        `;
    },

    groupByDate(achievements) {
        const grouped = {};
        achievements.forEach(a => {
            if (!grouped[a.date]) {
                grouped[a.date] = [];
            }
            grouped[a.date].push(a);
        });
        return grouped;
    },

    formatDateHeader(dateStr) {
        return Utils.formatDateHeader(dateStr);
    },

    generateAchievementCard(achievement) {
        const icon = this.getAchievementIcon(achievement);
        const description = this.getAchievementDescription(achievement);
        const typeClass = `achievement-${achievement.type}`;

        return `
            <div class="achievement-card ${typeClass}">
                <div class="achievement-icon">${icon}</div>
                <div class="achievement-content">
                    <div class="achievement-player">${achievement.player_name}</div>
                    <div class="achievement-description">${description}</div>
                </div>
            </div>
        `;
    },

    getAchievementIcon(achievement) {
        const icons = {
            'new_brawler': '🎮',
            'maxed_brawler': '👑',
            'gadget': '<img src="assets/icons/gadget.webp" alt="Gadget" class="achievement-icon-img">',
            'star_power': '<img src="assets/icons/starpower.webp" alt="Star Power" class="achievement-icon-img">',
            'hypercharge': '<img src="assets/icons/hypercharge.webp" alt="Hypercharge" class="achievement-icon-img">',
            'prestige': '🏆',
            'trophy_milestone': '🏅',
            'first_prestige_level': '⭐',
            'total_prestiges': '💎'
        };
        return icons[achievement.type] || '🏆';
    },

    getAchievementDescription(achievement) {
        const brawler = achievement.brawler ? `<span class="highlight">${achievement.brawler}</span>` : '';

        switch (achievement.type) {
            case 'new_brawler':
                return `Unlocked ${brawler}`;
            case 'maxed_brawler':
                return `Maxed out ${brawler}`;
            case 'gadget':
                return `Unlocked <span class="highlight">${achievement.item_name || 'gadget'}</span> for ${brawler}`;
            case 'star_power':
                return `Unlocked <span class="highlight">${achievement.item_name || 'star power'}</span> for ${brawler}`;
            case 'hypercharge':
                return `Unlocked <span class="highlight">hypercharge</span> for ${brawler}`;
            case 'prestige':
                return `Reached <span class="highlight">Prestige ${achievement.prestige_level}</span> with ${brawler}`;
            case 'trophy_milestone':
                return `Reached <span class="highlight">${achievement.milestone_value.toLocaleString()} trophies</span>`;
            case 'first_prestige_level':
                return `First brawler to reach <span class="highlight">Prestige ${achievement.prestige_level}</span>`;
            case 'total_prestiges':
                return `Accumulated <span class="highlight">${achievement.milestone_value} total prestiges</span>`;
            default:
                return `Achievement: ${achievement.type}`;
        }
    },

    formatAchievementShort(achievement) {
        const brawler = achievement.brawler;
        switch (achievement.type) {
            case 'prestige':
                return `${brawler} P${achievement.prestige_level}`;
            case 'maxed_brawler':
                return `${brawler} Maxed`;
            case 'new_brawler':
                return `New: ${brawler}`;
            default:
                return brawler;
        }
    },

    setupFilterHandlers() {
        // Player filter
        const playerFilter = document.getElementById('playerFilter');
        if (playerFilter) {
            playerFilter.addEventListener('change', (e) => {
                this.currentFilters.player = e.target.value;
                this.applyFilters();
                this.updateURL();
                this.render();
                this.setupFilterHandlers(); // Re-attach handlers
            });
        }

        // Date range filter
        const dateFilter = document.getElementById('dateRangeFilter');
        if (dateFilter) {
            dateFilter.addEventListener('change', (e) => {
                this.currentFilters.dateRange = e.target.value;
                this.applyFilters();
                this.updateURL();
                this.render();
                this.setupFilterHandlers();
            });
        }

        // Select all button
        const selectAllBtn = document.getElementById('selectAllTypes');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.currentFilters.types = new Set(['new_brawler', 'maxed_brawler', 'gadget', 'star_power', 'hypercharge', 'prestige', 'trophy_milestone', 'first_prestige_level', 'total_prestiges']);
                this.applyFilters();
                this.updateURL();
                this.render();
                this.setupFilterHandlers();
            });
        }

        // Deselect all button
        const deselectAllBtn = document.getElementById('deselectAllTypes');
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                this.currentFilters.types.clear();
                this.applyFilters();
                this.updateURL();
                this.render();
                this.setupFilterHandlers();
            });
        }

        // Type checkboxes
        const typeCheckboxes = document.querySelectorAll('.type-checkbox');
        typeCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const type = e.target.value;
                if (e.target.checked) {
                    this.currentFilters.types.add(type);
                } else {
                    this.currentFilters.types.delete(type);
                }
                this.applyFilters();
                this.updateURL();
                this.render();
                this.setupFilterHandlers();
            });
        });
    }
};
