# Frontend Feature Specification

## Current Implementation Status (2026-03-25)

The dashboard is fully functional with 3 main tabs. This spec now includes both **implemented features** (✅) and **planned battlelog enhancements** (🔜).

---

## Tab 1: Club Overview

### ✅ Implemented
- **Trophy Timeline Chart**: Line chart showing all players' trophy progression over time
- **Quick Stats Grid**:
  - Total Members
  - Combined Trophies
  - Average Trophies
  - Prestige Brawlers (1000+ trophy brawlers across all players)

### 🔜 Planned (Battlelog Data)

**Enhanced Quick Stats Grid:**
Add 4 new stats to existing grid:
- **Total Battles Tracked** - Sum of all battles from battlelog data
- **Club Avg Win Rate** - Overall win % across all members
- **Most Active (7d)** - Player with most games in last 7 days
- **Best Win Rate (7d)** - Player with highest WR (min 10 games to qualify)

**NEW: Club Leaderboards Card:**
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
- **Hybrid timeline**: Daily snapshots + hourly battlelog data (no toggle needed)
- Automatically uses most granular data available at each point in time
- Early history: Daily snapshots (one point per day)
- Recent days: Battle-by-battle points (multiple per day)
- Seamless transition - line becomes more detailed as battlelog data becomes available
- Tooltip on snapshot points: "March 20, 2026: 15,420 trophies"
- Tooltip on battle points: "March 25, 3:42 PM: Brawl Ball win with Colt (+8) → 15,650 trophies"
- Time range filter: All Time / Last Month / Last Week / Yesterday
- Trend indicators: 1-day, 7-day, 30-day trophy changes with arrows

**Gamemode Wins**:
- 3v3 Victories
- Solo Victories
- Duo Victories
- Total Victories

**Prestige Distribution**:
- Bar chart showing brawler count by prestige level (0-5+)
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
- Search by brawler name

### 🔜 Planned (Battlelog Data)

**NEW: Battle Performance Card** (insert after Gamemode Wins):
```
Win Rate Analysis
├─ Overall WR: 65.4% (123W - 65L)
├─ Ranked WR: 72% (36W - 14L)
├─ Best Mode: Brawl Ball (75% in 40 games)
└─ Recent Form: Last 10 games (7W - 3L) with visual: W W L W W W L W W L

Star Player Stats
├─ MVP Rate: 28% (35/125 games)
├─ Most MVPs with: Colt (12 times)
```

**NEW: Brawler Performance Rankings Card:**
Top 5 lists for different metrics:
- **Highest Win Rate** (min 10 games to qualify)
- **Most Played** (total game count)
- **Trophy Grinders** (biggest net trophy gain from battles)
- **MVP Machines** (most star player awards)

**NEW: Brawler Battle Stats Table** (separate from existing Brawler Details table):
A new table focused on battle performance (keeps existing item-tracking table unchanged):
- Columns: Brawler name | Games Played | Win Rate (W-L + %) | Net Trophies | Last Played | MVP Count
- Sortable by all columns
- Shows battle-specific stats for each brawler

**NEW: Game Mode Distribution Chart:**
Pie/donut chart showing % of games in each mode:
- Example: Brawl Ball 35%, Gem Grab 20%, Knockout 15%, etc.

**NEW: Teammate Chemistry Card** (after Account Worth):
List all tracked players with your win rate when playing together (all modes combined):
```
Teammates Win Rate (All Modes)
1. Mathys      80% WR    20 games    16W-4L
2. Nielsen     75% WR    16 games    12W-4L
3. Louis       68% WR    25 games    17W-8L
```

**NEW: Activity Heatmap Chart** (after Trophy Progression):
- 7×24 grid (rows = days of week, columns = hours of day)
- Color intensity = games played in that time slot
- Shows when player is most active
- Example insight: "You play most on Saturday evenings"

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

### 🔜 Planned (Battlelog Data)

**Enhanced Trophy Timeline**:
- Add view toggle: **[Daily Snapshots] [All Battles (Hourly)]**
- Daily Snapshots mode: Original view (one point per day)
- All Battles mode: Every single battle plotted as individual points
- Tooltip on battles: "Mar 25, 3:42 PM: Brawl Ball win with Colt (+8)"
- Reveals grind sessions, win streaks, tilt sessions in real-time

**NEW: Win Rate Timeline Chart** (insert between Trophy and Gamemode Wins):
- Rolling 20-game average win rate over time
- Line per player, Y-axis = 0-100%
- Smoothed line to reduce noise from individual games
- Filter dropdown: All Modes / Ranked / Brawl Ball / Gem Grab / etc.
- Shows if players are improving or declining over time

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

### ✅ Phase 1: Core Features (COMPLETE)
1. Tab-based navigation system (3 tabs)
2. Club overview with trophy timeline
3. Individual player detailed stats view
4. Per-brawler breakdown table (item tracking)
5. All 5 timeline charts (trophy, wins, collection, maxed, prestige)
6. Power & prestige distribution charts
7. Account worth calculator with progression tracking
8. Trophy progression with trend indicators (1d/7d/30d)

### 🔜 Phase 2: Battlelog Integration - Quick Wins (NEXT)
**Tab 1 - Club Overview:**
1. Enhanced quick stats (4 new stats: battles tracked, avg WR, most active, best WR)
2. Club Leaderboards card (Grind King, Tryhard, Star Player, Hot Streak)

**Tab 2 - Player Stats:**
3. Battle Performance card (WR analysis + star player stats)
4. Brawler Performance Rankings card (top 5 lists)
5. Game Mode Distribution pie chart

**Tab 3 - Timelines:**
6. Win Rate Timeline chart (rolling average)

### 🔜 Phase 3: Battlelog Integration - Medium Effort
**Tab 2 - Player Stats:**
7. Hybrid trophy progression chart (daily + hourly data, automatic)
8. Brawler Battle Stats table (new separate table for battle performance)
9. Teammate Chemistry card (win rates with each teammate)

**Tab 3 - Timelines:**
10. Enhanced trophy timeline with view toggle (daily vs hourly)
11. Activity Timeline chart (games per day)
12. Enhanced Gamemode Wins Timeline (dual-axis with WR overlay)

### 🔜 Phase 4: Battlelog Integration - Advanced
**Tab 2 - Player Stats:**
13. Activity Heatmap chart (7×24 grid)

**Tab 3 - Timelines:**
14. Mode Popularity Timeline (stacked area chart)

**New Tab 4 - Battles:**
15. Recent Battles Feed (filterable list)
16. Map Performance table
17. Head-to-Head Comparison
18. Streak Tracker

### 🔜 Phase 5: Meta Analysis Deep Dive
**New Tab 5 - Meta Analysis:**
19. Brawler Meta Analysis (most faced, hardest matchups, best counters)
20. Performance by Time (time of day, day of week, tilt detector)
21. Trophy Efficiency (trophies/hour, best sessions, worst tilts)
22. Teammate Synergy Matrix (full grid of duo combinations)

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
