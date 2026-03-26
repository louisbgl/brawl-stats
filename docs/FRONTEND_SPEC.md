# Frontend Feature Specification

## Current Implementation Status (2026-03-26)

The dashboard is fully functional with 3 main tabs. Tabs 1 & 2 are feature-complete with all planned battlelog enhancements implemented. This spec now tracks both **completed features** (✅) and **planned features** (🔜).

---

## Tab 1: Club Overview

### ✅ Implemented
- **Trophy Timeline Chart**: Line chart showing all players' trophy progression over time
- **Quick Stats Grid**:
  - Total Members
  - Combined Trophies
  - Average Trophies
  - Prestige Brawlers (1000+ trophy brawlers across all players)

### 🔜 Planned (Future Enhancements)

**Enhanced Quick Stats Grid** (requires battlelog data):
Add 4 new stats to existing grid:
- **Total Battles Tracked** - Sum of all battles from battlelog data
- **Club Avg Win Rate** - Overall win % across all members
- **Most Active (7d)** - Player with most games in last 7 days
- **Best Win Rate (7d)** - Player with highest WR (min 10 games to qualify)

**NEW: Club Leaderboards Card** (requires battlelog data):
Mini competitive rankings:
- **Grind King** - Most total battles played all-time
- **Tryhard** - Highest % of games in ranked mode
- **Star Player** - Most MVP awards total
- **Hot Streak** - Longest current win streak

---

## Tab 2: Player Stats (Detailed Individual View)

### ✅ Implemented

**Overview Stats**:
- Current Trophies vs Max Trophies (side by side)
- Brawlers Owned
- Maxed Brawlers (P11 + 2 gadgets + 2 star powers + hypercharge)
- Average Trophies per Brawler

**Trophy Progression Chart**:
- **Hybrid timeline**: Daily snapshots + battlelog data for recent activity
- Snapshots as anchor points (source of truth for historical data)
- Battle-by-battle granularity after last snapshot (shows recent playing sessions)
- Intelligent x-axis: Time-based for short ranges (today/yesterday), date-based for longer ranges
- Time range filters: All Time / Month / Week / Yesterday / Today
- Smooth progression with proper timezone handling (CET/CEST)
- Trend indicators: 1-day, 7-day, 30-day trophy changes with arrows
- Chart automatically adapts to data availability

**Gamemode Wins**:
- 3v3 Victories
- Solo Victories
- Duo Victories
- Total Victories

**Prestige Distribution**:
- Bar chart showing brawler count by prestige level (0-7)
- First achievement dates (First Prestige 2, 3, 4, 5)

**Power Level Distribution**:
- Bar chart showing brawlers at each power level (P1-P11)

**Account Worth & Progression**:
- Progress percentage badge
- Current worth vs Cost to Max (coins & power points)
- Missing items breakdown (gadgets, star powers, hypercharges, brawlers below P11)
- List of missing brawlers

**Brawler Details Table**:
- Sortable, searchable, filterable table
- Columns: Brawler name, Power level, Gadgets (2), Star Powers (2), Hypercharge, Gears
- Color-coded rows: Green (fully maxed), Yellow (almost maxed), Red (missing items)
- Filters: All / Fully Maxed / Missing Items / Not Power 11
- Search by brawler name (working correctly with proper table targeting)

**Battle Performance Card** (battlelog data):
- Overall win rate with W-L record
- Ranked mode win rate
- Best game mode (highest WR with min 10 games)
- Recent form: Last 10 games with W/L visual indicator
- MVP rate percentage
- Most MVPs by brawler

**Brawler Performance Rankings** (battlelog data):
Top 5 lists showing:
- **Highest Win Rate** (min 10 games to qualify)
- **Most Played** (total game count)
- **Trophy Grinders** (biggest net trophy gain)
- **MVP Machines** (most star player awards)

**Game Mode Distribution Chart** (battlelog data):
- Pie chart showing percentage of games in each mode
- Hover for exact game counts

**Brawler Battle Stats Table** (battlelog data):
Separate table focused on battle performance:
- Columns: Brawler | Games | Win Rate | Net Trophies | Last Played | MVPs
- Sortable by all columns
- Shows comprehensive battle stats per brawler

**Teammate Chemistry Card** (battlelog data):
- Win rate when playing with each tracked club member
- Filters to only show club members (tracked players)
- Shows games played together and W-L record

**Activity Heatmap** (battlelog data):
- 7×24 grid (days of week × hours of day)
- Color intensity based on games played in each time slot
- Shows optimal playing times

### 🔜 Planned (Future Enhancements)

No additional features planned for Tab 2 - feature complete!

---

## Tab 3: Timelines (Historical Progression Charts)

### ✅ Implemented

**Trophy Timeline**:
- Line chart for all players (overall trophies)
- Dropdown filter: Overall OR specific brawler comparison
- Shows who's progressing fastest with each brawler

**Gamemode Wins Timeline**:
- Filter: Overall / 3v3 Only / Solo Only / Duo Only
- Line chart showing win counts over time

**Brawler Collection Timeline**:
- Number of brawlers owned over time per player
- Shows who's collecting fastest

**Maxed Brawlers Timeline**:
- Count of fully maxed brawlers over time
- Maxed = P11 + 2 gadgets + 2 star powers + hypercharge

**Prestige Brawlers Timeline**:
- Count of brawlers with 1000+ trophies per player

### 🔜 Planned (Battlelog Data - Phase 3)

**Enhanced Trophy Timeline**:
- Add view toggle: **[Daily Snapshots] [All Battles]**
- Daily Snapshots mode: Original view (one point per day)
- All Battles mode: Every single battle plotted as individual points
- Tooltip on battles: "Mar 25, 3:42 PM: Brawl Ball win with Colt (+8)"
- Reveals grind sessions, win streaks, tilt sessions in real-time

**NEW: Activity Timeline Chart** (insert after Prestige):
- Games played per day (bar or area chart)
- Shows activity spikes and patterns
- Reveals who grinds on weekends vs daily players
- Filter: Last 7 days / Last 30 days / All time

**Enhanced Gamemode Wins Timeline**:
- Add dual-axis chart: wins (left Y-axis) + win rate % (right Y-axis)
- Toggle: "Show win rate overlay" (adds dotted line showing WR trending)

**NEW: Mode Popularity Timeline:**
- Stacked area chart showing % distribution of modes over time
- Reveals if club preferences shift (e.g., casual → ranked)
- Shows which modes become more/less popular

---

## Tab 4: Battles (New Tab - Deep Dive)

### 🔜 Planned (Battlelog Data)

**Recent Battles Feed Card**:
- Scrollable list of last 100 battles across all tracked players
- Filters: Player dropdown / Mode dropdown / Result dropdown (All/Wins/Losses) / Date range
- Each battle entry displays:
  ```
  Louis | Colt P11 | Brawl Ball | Hot Potato | ✅ Victory +8 | 2h ago
  [Teammates: Mathys (Shelly), Nielsen (Mortis)]
  ```
- Click to expand for full details (all 6 players, duration, etc.)
- Color-coded: Green background for wins, red for losses

**Map Performance Table Card**:
- Win rates per map (min 5 games to qualify)
- Columns: Map | Mode | Games | Wins | Win Rate
- Sorted by win rate (best maps first)
- Helps identify which maps to play/avoid

**Head-to-Head Comparison Card**:
- Two player selector dropdowns + "Compare" button
- Shows:
  - When playing together: Combined WR, games played, most played mode
  - When playing same brawler: Who has better stats (WR, trophies, MVPs)
  - Activity comparison: Who plays more, when they play

**Streak Tracker Card**:
- **Current Streaks**: "Louis on 7-game win streak!" with player list
- **Best Streaks (All-Time)**: Longest win streak & loss streak per player
- **Momentum Indicator**: Win rate last 5 games vs last 20 games (trending up/down)

## Tab 5: Meta Analysis (New Tab - Advanced Analytics)

### 🔜 Planned (Battlelog Data)

**Brawler Meta Analysis Card**:
- **Most Faced Enemy Brawlers**: Which brawlers you encounter most often
  - Example: "You face Colt in 25% of your games"
- **Hardest Matchups**: Enemy brawlers you have lowest WR against
  - Example: "Your WR vs enemy Mortis: 35% (7W-13L)"
- **Best Counters**: Your brawlers with highest WR vs specific enemies
  - Example: "Your Shelly has 80% WR vs enemy Bull"

**Performance by Time Card**:
- **Best/Worst Times of Day**: Breakdown by morning/afternoon/evening/night
- **Day of Week Analysis**: Weekday vs weekend performance
  - Example: "You win 72% on weekends, 58% on weekdays"
- **Tilt Detector**:
  - Warn after X consecutive losses
  - Show WR after losing streaks vs after winning streaks
  - Suggest "Take a break" notifications

**Trophy Efficiency Card**:
- **Trophies per Hour**: How fast you gain trophies when playing
- **Best Grind Sessions**: Sessions with biggest net trophy gain (date + amount)
- **Worst Tilt Sessions**: Sessions with biggest trophy losses (date + amount)
- Helps identify optimal play patterns

**Teammate Synergy Matrix Card**:
Full grid showing WR for every teammate duo combination:

|        | You | Mathys | Nielsen | Louis |
|--------|-----|--------|---------|-------|
| You    | -   | 80%    | 75%     | 68%   |
| Mathys | 80% | -      | 82%     | 70%   |
| Nielsen| 75% | 82%    | -       | 65%   |
| Louis  | 68% | 70%    | 65%     | -     |

Only shows pairs that have played together (min 5 games)

---

## Data Sources

### Daily Snapshot Data (Existing)
- Collected once per day at midnight CET
- Files: `data/YYYY-MM-DD.json` + `data/latest.json`
- Contains: trophies, wins (3v3/solo/duo), brawler collection, power levels, items

### Battlelog Data (New - Hourly Collection)
- Collected every hour via GitHub Actions
- Files: `data/battlelogs/{TAG}.json` (one per player)
- Contains: Raw battle items with mode, result, brawler, trophy_change, teammates, timestamp
- API limit: 25 most recent battles per request
- Hourly collection ensures no battles are lost

### Reference Data
- File: `data/brawlers.json`
- Complete brawler catalog with gadgets, star powers, hypercharges, gears
- Updated daily

---

## Technical Stack

- **Frontend**: Vanilla JavaScript (ES6 modules)
- **Charts**: Chart.js
- **Styling**: Custom CSS with purple gradient theme
- **Deployment**: GitHub Pages (auto-deploys on push to main)

### JavaScript Modules
- `js/data.js`: DataManager - loads and caches all JSON data
- `js/app.js`: Main app logic, tab switching, initialization
- `js/charts.js`: ChartsManager - timeline charts for Tab 1 & 3
- `js/player-charts.js`: PlayerChartsManager - individual player charts
- `js/player-stats.js`: PlayerStatsManager - detailed player view
- `js/config.js`: Frontend configuration constants

---

## Implementation Phases

### ✅ Phase 1: Core Dashboard (COMPLETE)
1. Tab-based navigation system (3 tabs)
2. Club overview with trophy timeline
3. Individual player detailed stats view
4. Per-brawler breakdown table (item tracking)
5. All 5 timeline charts (trophy, wins, collection, maxed, prestige)
6. Power & prestige distribution charts
7. Account worth calculator with progression tracking
8. Trophy progression with trend indicators (1d/7d/30d)

### ✅ Phase 2: Tab 2 Battlelog Integration (COMPLETE)
1. Hybrid trophy progression chart (snapshots + battlelog granularity)
2. Battle Performance card (WR analysis + star player stats)
3. Brawler Performance Rankings card (top 5 lists)
4. Game Mode Distribution pie chart
5. Brawler Battle Stats table (separate from item-tracking table)
6. Teammate Chemistry card (filtered to club members only)
7. Activity Heatmap chart (7×24 grid)
8. Smart x-axis switching (time-based for short ranges, date-based for long ranges)
9. Working filters on all tables and charts

### 🔜 Phase 3: Tab 3 Enhancements (CURRENT - NEXT UP)
**Timelines Tab:**
1. Activity Timeline chart (games per day with date range filter)
2. Enhanced Trophy Timeline with view toggle (daily snapshots vs all battles)
3. Enhanced Gamemode Wins Timeline (dual-axis with WR overlay toggle)
4. Mode Popularity Timeline (stacked area chart showing mode distribution)

### 🔜 Phase 4: Tab 1 Enhancements
**Club Overview:**
1. Enhanced quick stats (4 new stats: battles tracked, avg WR, most active, best WR)
2. Club Leaderboards card (Grind King, Tryhard, Star Player, Hot Streak)

### 🔜 Phase 5: New Tab - Battles Deep Dive
**New Tab 4 - Battles:**
1. Recent Battles Feed (filterable list)
2. Map Performance table
3. Head-to-Head Comparison
4. Streak Tracker

### 🔜 Phase 6: New Tab - Meta Analysis
**New Tab 5 - Meta Analysis:**
1. Brawler Meta Analysis (most faced, hardest matchups, best counters)
2. Performance by Time (time of day, day of week, tilt detector)
3. Trophy Efficiency (trophies/hour, best sessions, worst tilts)
4. Teammate Synergy Matrix (full grid of duo combinations)

---

## UI/UX Principles

- **Purple gradient theme**: Maintained throughout
- **Chart.js**: All visualizations
- **Mobile responsive**: Works on all screen sizes
- **Clean, organized sections**: Card-based layout
- **Interactive tooltips**: Hover for exact values on charts
- **Smart filtering**: Search, sort, and filter everywhere
- **Color coding**: Green (good), Yellow (warning), Red (missing/bad)
- **Performance**: Lazy loading, efficient data structures
