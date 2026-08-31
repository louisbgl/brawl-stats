# V2 Frontend Architecture

**Status**: Not yet deployed. Main branch runs v1 frontend (reads raw snapshots). V2 frontend reads aggregated data only.

**Incompatibility**: v1 and v2 frontends cannot coexist. Data structures completely different.

---

## Architecture Overview

**Type**: Tab-based SPA with hash routing and URL state persistence

**Data Strategy**:
- Reads ONLY from `data/aggregated/**/*.json` (never touches raw data)
- Loads club-summary.json on init (cached for session)
- Other files loaded lazily per tab

**No build step**: Vanilla JavaScript, ES6 modules via `<script>` tags

---

## Module Structure

**Load order matters** - dependencies must load before dependents.

```html
<!-- Core (must load first) -->
<script src="src/frontend/js/common.js"></script>
<script src="src/frontend/js/data.js"></script>

<!-- Tab modules -->
<script src="src/frontend/js/overview-charts.js"></script>
<script src="src/frontend/js/overview-lb.js"></script>
<script src="src/frontend/js/overview.js"></script>

<script src="src/frontend/js/player-stats-timeline.js"></script>
<script src="src/frontend/js/player-stats.js"></script>

<script src="src/frontend/js/achievements.js"></script>

<script src="src/frontend/js/battle-details.js"></script>
<script src="src/frontend/js/battles.js"></script>

<!-- Application (must load last) -->
<script src="src/frontend/js/router.js"></script>
<script src="src/frontend/js/app.js"></script>
```

### Module Responsibilities

**`common.js`** - GameConfig utilities (loaded by everything)
- Mode names/colors: `getModeName()`, `getModeColor()`
- Rank formatting: `formatRank()`, `formatRankColored()`, `getRankColor()`
- Trophy formatting: `formatTrophyColored()`
- Player colors: `getPlayerChartColor(tag)` - consistent across all charts
- Date/time utilities

**`data.js`** - DataLoader (simple synchronous API)
- `getClubSummary()` - Returns club-summary.json (cached)
- `getPlayerIndex()` - Returns player list from club-summary
- Loads aggregated files, no raw data access

**Tab modules** - Self-contained, each manages one tab
- `overview.js` + helpers (overview-charts.js, overview-lb.js)
- `player-stats.js` + `player-stats-timeline.js`
- `achievements.js`
- `battles.js` + `battle-details.js`

**`router.js`** - Hash-based routing, URL state management

**`app.js`** - Initialization, tab switching

---

## Tab Specifications

### Overview (`#overview[/timeRange][/hiddenPlayers][/leaderboardCategory]`)

**Data**: `data/aggregated/club-summary.json`

**Sections**:
1. Quick stats (5 cards: members, trophies, battles, win rate, most played mode)
2. Trophy timeline chart (Chart.js multi-dataset line chart)
   - Time range buttons: 7/30/90 days, all time (default: 30)
   - Player visibility toggle via legend click
   - Hidden players saved in URL
3. Leaderboards (multiple categories, tabs for switching)
   - Always shown: trophies, ranked_best, winrate, total_battles, maxed_brawlers, brawlers_1k
   - Dynamic: brawlers_2k, brawlers_3k (only if data present)

**URL State**:
- `/timeRange` - 7, 30, 90, or "all" (default: 30)
- `/hiddenPlayers` - Comma-separated tags (e.g., `TAG1,TAG2`)
- `/leaderboardCategory` - Active leaderboard (default: "trophies")
- Empty params use defaults, URL reflects current state

**Implementation Notes**:
- Chart legend click → update `hiddenPlayers` set → sync to URL
- Time range buttons → update range → re-render chart (destroy old first)
- Leaderboard tabs → update category → sync to URL
- All state changes: update localStorage + URL (via `history.replaceState`)

---

### Players (`#player[/playerTag][/timeRange]`)

**Data**:
- `data/aggregated/club-summary.json` (player selector)
- `data/aggregated/players/{TAG}/stats.json` (quick stats)
- `data/aggregated/players/{TAG}/timeline.json` (trophy progression)

**Sections**:
1. Player selector (buttons, sorted by trophies)
   - Click to select → show stats
   - Click again to deselect → show empty state
2. Quick stats (4 cards: trophies, best rank, total wins, brawlers owned)
3. Trophy timeline chart
   - Time range buttons: 7/30/90 days, all time
   - Shows trophy gain/loss for selected range

**URL State**:
- `/playerTag` - Selected player tag (e.g., `#LLJGJQVY`)
- `/timeRange` - Timeline range (default: 30)
- No player selected → show empty state message

**Implementation Notes**:
- Player selection saved to localStorage + URL
- Validation: if tag in URL not in club → clear selection, show empty state
- Timeline: extracted to `player-stats-timeline.js` (callback pattern for state updates)
- Parent (`player-stats.js`) maintains state, child renders UI

---

### Achievements (`#achievements`)

**Data**: `data/aggregated/achievements.json` (~150KB, 3700+ entries)

**Display**:
- Timeline grouped by date (newest first)
- Filters: player dropdown, date range, achievement type checkboxes
- Types: trophy milestones, prestige levels, maxed brawlers, new brawlers, items

**Implementation Notes**:
- No URL state for filters (not important enough to bookmark)
- Client-side filtering only (all data loaded at once)
- No pagination (fast enough with 3700 entries)

---

### Battles (`#battles`)

**Data**: `data/aggregated/battles/*.json` (7-day segments)
- `recent.json` (~800KB, last 7 days)
- `week-2.json`, `week-3.json`, etc. (loaded on demand)

**Display**:
- Battle feed with filters (player, mode, result)
- Expandable cards showing full teams
- Deduplicated (multiple tracked players in same match merged)

**Implementation Notes**:
- Load `recent.json` on tab open
- Older segments loaded if user scrolls or filters require them
- Filters client-side (no URL state)

---

## Key Patterns

### URL State Management

**Goal**: Share/bookmark tab state via URL

**Format**: `#tab/param1/param2/param3`

**Update without re-render**:
```javascript
// ✅ Correct - updates URL without triggering router
window.history.replaceState(null, '', '#player/TAG123/30');

// ❌ Wrong - triggers hashchange → router re-renders entire tab
window.location.hash = 'player/TAG123/30';
```

**When to use which**:
- `history.replaceState()` - Updating state while staying on same tab
- `location.hash = ...` - Switching to different tab

**Validation**:
Always validate URL params against current data:
```javascript
// Player could have left club since URL was bookmarked
if (tagFromURL && !this.isValidPlayerTag(tagFromURL, clubSummary)) {
    console.warn(`Invalid tag: ${tagFromURL}`);
    this.selectedPlayerTag = null; // Reset to default
    window.history.replaceState(null, '', '#player'); // Clean URL
    // Continue rendering with defaults
}
```

---

### localStorage Backup

**Pattern**: URL takes precedence, localStorage is fallback

```javascript
// Load order: URL → localStorage → default
let timeRange = urlParams[0]; // From URL
if (!timeRange) {
    timeRange = localStorage.getItem('overview.timeRange') || '30'; // Fallback
}

// Always save on change
localStorage.setItem('overview.timeRange', timeRange);
```

**Why both?**
- URL = shareable, bookmarkable
- localStorage = persists user preferences across sessions

**Validation**: Validate localStorage same as URL (data could have changed)

---

### Chart.js Patterns

**Destroy before re-render**:
```javascript
if (this.currentChart) {
    this.currentChart.destroy();
}
this.currentChart = new Chart(canvas, config);
```

**Save/restore hidden state**:
```javascript
// Before destroy, save which datasets are hidden
this.currentChart.data.datasets.forEach((dataset, idx) => {
    const meta = this.currentChart.getDatasetMeta(idx);
    if (meta.hidden) {
        this.hiddenPlayers.add(tag); // Save to set
    }
});

// After creating new chart, restore
this.currentChart.data.datasets.forEach((dataset, idx) => {
    const shouldBeHidden = this.hiddenPlayers.has(tag);
    this.currentChart.setDatasetVisibility(idx, !shouldBeHidden);
});
this.currentChart.update('none'); // Force update without animation
```

**Legend click handler**:
```javascript
this.currentChart.options.onLegendClick = (chart) => {
    // Sync hiddenPlayers set with chart state
    this.hiddenPlayers.clear();
    chart.data.datasets.forEach((dataset, idx) => {
        if (chart.getDatasetMeta(idx).hidden) {
            this.hiddenPlayers.add(tag);
        }
    });
    this.updateURL(); // Persist to URL
};
```

---

### Callback Pattern (Child Modules)

**Problem**: Child module needs to update parent state (localStorage, URL)

**Solution**: Parent passes callback to child

**Example** (`player-stats-timeline.js`):
```javascript
// Child module signature
PlayerStatsTimeline.render(timelineData, tag, currentRange, onRangeChange) {
    // When user clicks time range button
    btn.addEventListener('click', () => {
        const newRange = parseInt(btn.dataset.days);

        // Update child UI
        this.renderChart(container, timelineData, playerColor, newRange);

        // Notify parent via callback
        onRangeChange(newRange);
    });
}

// Parent calls child
PlayerStatsTimeline.render(
    timelineData,
    tag,
    this.currentTimelineRange,
    (newRange) => {
        // Parent updates state
        this.currentTimelineRange = newRange;
        localStorage.setItem('playerStats.timeRange', newRange.toString());
        window.history.replaceState(null, '', `#player/${tag}/${newRange}`);
    }
);
```

**Why**: Decouples child from parent implementation, allows extracting complex UI to separate files

---

## Display Formatting

**Always use common.js formatters** - never implement custom formatting

### Mode Names
```javascript
// ❌ Wrong
const modeName = mode; // Shows "brawlBall"

// ✅ Correct
const modeName = GameConfig.getModeName(mode); // Shows "Brawl Ball"
```

### Ranks
```javascript
// ❌ Wrong
const rankText = `Rank ${rankNum}`; // Shows "Rank 16"

// ✅ Correct
const rankText = GameConfig.formatRank(rankNum); // Shows "Legendary I"
const rankHTML = GameConfig.formatRankColored(rankNum); // With color
```

### Trophies
```javascript
// ❌ Wrong
const trophyText = `${trophies} trophies`;

// ✅ Correct
const trophyHTML = GameConfig.formatTrophyColored(trophies); // Yellow colored
```

### Player Colors
```javascript
// ❌ Wrong
const color = '#' + Math.random().toString(16).substr(-6); // Random

// ✅ Correct
const color = GameConfig.getPlayerChartColor(tag); // Consistent across all charts
```

---

## Common Mistakes

### ❌ Mistake: Using `window.location.hash` while on same tab
**Problem**: Triggers hashchange event → router re-renders entire tab → scroll to top

**Fix**: Use `history.replaceState()` to update URL without triggering router

---

### ❌ Mistake: Showing raw mode strings in UI
**Problem**: Users see `"brawlBall"`, `"gemGrab"` instead of proper names

**Fix**: Always use `GameConfig.getModeName(mode)`

---

### ❌ Mistake: Implementing custom formatters for ranks/trophies/modes
**Problem**: Inconsistent formatting, duplicated code

**Fix**: Check `common.js` first - formatters already exist

---

### ❌ Mistake: Trusting URL params without validation
**Problem**: Bookmarked URL with player tag who left club → errors

**Fix**: Validate all URL params against current data, fallback to defaults if invalid

---

### ❌ Mistake: Not saving state to localStorage
**Problem**: User preferences lost on page reload

**Fix**: Save to both localStorage and URL on every state change

---

### ❌ Mistake: Loading same data multiple times
**Problem**: Multiple tabs loading club-summary.json redundantly

**Fix**: DataLoader caches club-summary.json on first load, reuses for all tabs

---

## Empty States

**Players tab**: Show message when no player selected
```javascript
if (!this.selectedPlayerTag) {
    content.innerHTML = '<p style="text-align: center; ...">Select a player to view detailed stats</p>';
    return;
}
```

**Battles tab**: Show message if no battles match filters

**Overview tab**: Never empty (always have data from club-summary)

---

## Module Load Order Dependencies

**Critical**:
- `common.js` must load before everything (GameConfig used everywhere)
- `data.js` must load before tab modules (DataLoader.getClubSummary() etc.)
- `player-stats-timeline.js` must load before `player-stats.js`
- `router.js` and `app.js` must load last

**Why**: JavaScript `<script>` tags execute in order. Later scripts depend on earlier ones defining global objects.

---

## Date/Time Handling

**Snapshot dates**: `YYYY-MM-DD` format (ISO 8601)

**Battle timestamps**: `20260826T134521.000Z` format

**Timeline charts**: Parse dates client-side, filter based on selected range

**Relative times**: Battle feed shows "5m ago", "2h ago", etc.

---

## Performance

**Initial load**:
- Loads club-summary.json (~70KB) immediately
- Other files loaded lazily per tab

**Chart rendering**:
- Destroy old chart before creating new (prevents memory leaks)
- Use `update('none')` for immediate updates without animation

**Caching**:
- DataLoader caches club-summary.json for session
- Battle segments cached when loaded

---

## Future Improvements

**Commented in code**:
- Player stats timeline: Brawler filter (overlay multiple brawlers on chart)
  - Load `brawler-timelines.json` lazily
  - Multi-select UI, each brawler = separate line
  - Save selection to URL/localStorage

**Not implemented**:
- Battles tab: Mobile layout optimization (noted with WIP banner)
- Player stats: Additional sections from DATA_FLOW.md spec

---

## References

- **Data schema**: See `docs/DATA_FLOW.md` for complete aggregated data format
- **Deployment**: See `docs/V2_PROMOTION.md` for v1→v2 migration procedure
- **Common formatters**: Check `src/frontend/js/common.js` before implementing display logic
