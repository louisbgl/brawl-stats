# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Brawl Stars Club Tracker: An automated statistics tracking system for Brawl Stars club members with daily data collection via GitHub Actions and an interactive web dashboard. Data is collected at midnight CET and visualized using vanilla JavaScript with Chart.js.

**Live Dashboard:** https://louisbgl.github.io/brawl-stats/

## Development Commands

### Local Development
```bash
# Install dependencies (using uv package manager)
uv sync

# Run local development server
python3 -m http.server 8000 # Usually let the user start the server on their own, they prefer using the Live Server extension
# Then visit http://localhost:8000
```

### Data Collection
```bash
# Run manual data collection (fetches from API and saves to data/)
uv run python collect_data.py

# The automated daily collection runs via GitHub Actions at midnight CET
```

### Configuration
```bash
# Setup environment variables
cp .env.example .env
# Edit .env to add BRAWL_STARS_PROXY_URL or BRAWL_STARS_API_TOKEN
```

## Architecture

### Data Flow
1. **Collection (Python)**: `collect_data.py` fetches data from Brawl Stars API (or proxy) and generates daily JSON snapshots
2. **Storage**: Data stored as `data/YYYY-MM-DD.json` files + `data/latest.json` + `data/brawlers.json` reference
3. **Automation**: GitHub Actions workflow runs daily, commits new data, triggers GitHub Pages deployment
4. **Visualization (JavaScript)**: Frontend loads historical JSONs and renders interactive charts

### Python Backend (Data Collection)

**Key Modules:**
- `src/api.py`: API client for Brawl Stars API with caching for brawlers reference data. `api_call(endpoint)` auto-encodes `#` in tags.
- `src/models.py`: Dataclasses for daily snapshots (DailySnapshot, ClubSnapshot, PlayerSnapshot, BrawlerSnapshot)
- `src/battle_models.py`: Dataclasses for battle log tracking (BattleEntry, BattlePlayer, BattleBrawler, PlayerBattleLog). `won` is inferred from `trophy_change` sign.
- `src/battle_store.py`: Persistent storage for battle logs. Saves raw API items to `data/battlelogs/{TAG}.json`, deduped by `battleTime`. Use `update(tag)` to fetch and persist new battles, `load_raw(tag)` to read them back.
- `src/config.py`: Configuration including API credentials, club/player tags, and game constants
- `collect_data.py`: Main entry point that orchestrates daily data collection
- `test_api.py`: Interactive API playground (not part of data collection). Key functions: `call(endpoint)`, `pretty(data)`, `keys(data)` (schema analysis), `print_battles(data)`, `print_stored_battles(tag)`, `update_all_battlelogs()`, `all_player_tags()`.

**API Configuration:**
- Supports both direct API access (requires `BRAWL_STARS_API_TOKEN`) and proxy mode (requires `BRAWL_STARS_PROXY_URL`)
- Proxy is a Flask app (`proxy/main.py`) that provides static IP for GitHub Actions
- Environment variables loaded from `.env` file via python-dotenv

**Data Models Philosophy:**
- Python stores minimal raw data (IDs only for items like gadgets, star powers, hypercharges, gears)
- All analysis and lookups happen in JavaScript using `brawlers.json` reference data
- Keeps snapshot files compact while allowing frontend flexibility

### JavaScript Frontend (Visualization)

**Architecture Philosophy:**
This frontend is designed for AI-assisted development ("vibecoding"). All common patterns are extracted into shared helpers to minimize duplication and make the codebase easy to understand and modify.

**Core Modules (Load Order Matters):**

1. **`js/config.js`** - Game constants and utilities
   - `GameConstants`: All Brawl Stars game mechanics (upgrade costs, prestige threshold, item costs, color palettes)
   - `Utils`: Date/time parsing and formatting utilities
   - Load first - required by all other modules

2. **`js/helpers.js`** - Shared helper functions (single source of truth)
   - `BattlelogHelpers`: Battle data extraction (player lookup, teammates, win/loss detection, brawler stats calculation, trophy timeline construction)
   - `ChartHelpers`: Chart.js factories (common chart configs, dataset creation, animations, timestamp formatting)
   - `ViewHelpers`: HTML generation (stat boxes, filter selects, time formatting, item badges)
   - `CalculationHelpers`: Shared calculations (maxed brawler check, prestige level, upgrade costs)
   - Load second - used by all visualization modules

3. **`js/data.js`** - Data loading and caching
   - `DataManager`: Singleton that loads latest.json, historical snapshots, brawlers.json, and achievements.json
   - Provides `getAllPlayers()`, `findPlayerInSnapshot()`, `ensureHistoricalLoaded()`, etc.

4. **`js/battlelog-data.js`** - Battle log data management
   - `BattlelogDataManager`: Loads and caches battle logs from `data/battlelogs/{TAG}.json`
   - Lazy loads on first access to avoid blocking initial page load

5. **`js/battlelog-analytics.js`** - Battle analytics
   - `BattlelogAnalytics`: Win rate calculations, activity metrics, streaks, mode stats
   - Higher-level analytics built on `BattlelogHelpers`

**Visualization Modules:**

6. **`js/charts.js`** - Club-wide timeline charts
   - `ChartsManager`: Trophy timeline, wins by mode, collection, maxed brawlers, prestige, activity, mode popularity
   - Uses `ChartHelpers` for all chart creation

7. **`js/player-charts.js`** - Per-player charts
   - `PlayerChartsManager`: Prestige distribution, power distribution, trophy timeline, mode distribution, activity heatmap
   - Uses `ChartHelpers.createBarWithLabelsAnimation()` for value labels

8. **`js/player-stats.js`** - Individual player analysis
   - `PlayerStatsManager`: Detailed stats display, brawler breakdown, battle stats rankings
   - Uses `CalculationHelpers.calculateUpgradeCosts()` and `BattlelogHelpers.calculateBrawlerStats()`

9. **`js/achievements.js`** - Achievement timeline
   - `AchievementsManager`: Displays player milestones (new brawlers, prestige levels, trophy milestones)

10. **`js/battles.js`** - Battle feed
    - `BattlesManager`: Paginated battle log viewer with filters
    - Uses `BattlelogHelpers` for all battle data extraction

11. **`js/router.js`** - URL routing
    - `Router`: Hash-based routing for tabs and deep linking

12. **`js/app.js`** - Application initialization
    - Sets up tabs, loads initial data, handles player selection

**Key Design Patterns:**

- **No Code Duplication**: All chart configs, battle lookups, calculations, and date formatting use shared helpers
- **Single Source of Truth**: Game constants in `GameConstants`, colors in `COLOR_PALETTE`, all costs centralized
- **Explicit Dependencies**: Each file has a header comment listing what it depends on
- **Lazy Loading**: Battle logs and historical data load on-demand to optimize initial page load
- **Stateless Helpers**: All helper functions are pure (no side effects) for predictability

**Common Tasks for AI:**

When adding a new chart:
1. Use `ChartHelpers.createLineDataset()` or `ChartHelpers.getCommonLineOptions()`
2. Reference `GameConstants.COLOR_PALETTE` for colors

When analyzing battles:
1. Use `BattlelogHelpers.getPlayerBrawlerFromBattle()` to find player's brawler
2. Use `BattlelogHelpers.calculateBrawlerStats()` for win rates and statistics
3. Use `BattlelogHelpers.isWin()` / `isLoss()` for result detection

When calculating costs:
1. Use `CalculationHelpers.calculateUpgradeCosts()` for account/brawler upgrade costs
2. Reference `GameConstants.POWER_POINT_COSTS`, `COIN_COSTS`, `ITEM_COSTS`

When formatting dates:
1. Use `Utils.parseBattleTime()` to parse API battle timestamps
2. Use `ViewHelpers.formatTimeAgo()` for relative times ("5m ago")
3. Use `Utils.formatDayLabel()` for date headers

**Tab Features:**
- **Club Overview**: Trophy timeline + quick stats for all members
- **Player Stats**: Prestige tracking, power distribution, per-brawler breakdown with missing items
- **Timelines**: Historical progression (trophies, wins, collection, maxed brawlers, prestige, activity, mode popularity)
- **Achievements**: Player milestone timeline with filters
- **Battles**: Paginated battle feed with player/mode/result filters

### Data Collection & Automation Pipeline

Data collection is automated using a multi-layered approach combining Oracle Cloud VM cron jobs, Git branching, and GitHub Actions:

#### 1. Oracle Cloud VM - Automated Collection (Primary)

The Oracle Cloud VM at `129.151.245.132` runs two automated collection tasks via cron (see `docs/ORACLE_CLOUD_VM.md` for details):

**Daily Profile Snapshots:**
- **Schedule**: 23:00 UTC daily (midnight CET winter / 1am CEST summer)
- **Script**: `/home/ubuntu/collect-snapshots.sh`
- **Branch workflow**:
  1. Pulls latest `main` into `data-snapshots` branch
  2. Runs `collect_data.py` (player profiles, trophies, brawlers)
  3. Saves to `data/YYYY-MM-DD.json` and `data/latest.json`
  4. Commits to `data-snapshots` branch
  5. Auto-merges to `main`
- **Logs**: `/home/ubuntu/collect-snapshots.log`

**Battlelog Collection:**
- **Schedule**: Every 30 minutes
- **Script**: `/home/ubuntu/collect-battlelogs.sh`
- **Branch workflow**:
  1. Pulls latest `main` into `data-battlelogs` branch
  2. Runs `collect_battlelogs.py` (recent battle history)
  3. Saves to `data/battlelogs/{TAG}.json` (one file per player)
  4. Commits to `data-battlelogs` branch
  5. Auto-merges to `main`
- **Logs**: `/home/ubuntu/collect-battlelogs.log`

**Why separate branches?**
- Prevents merge conflicts between concurrent collection tasks
- Each task can safely work on its own data files
- Auto-merge ensures `main` always has latest data

#### 2. GitHub Actions - Post-Processing & Deployment

**Achievement Generation** (`.github/workflows/generate-achievements.yml`):
- **Trigger**: Every push to `main` (after data collection merges)
- **What it does**:
  1. Analyzes all historical snapshots in `data/`
  2. Detects player milestones (new brawlers, prestige levels, trophy milestones)
  3. Generates `data/achievements.json`
  4. Commits back to `main`
- **Why post-push?** Achievements require full history analysis, too expensive for VM

**GitHub Pages Deployment** (`.github/workflows/deploy-pages.yml`):
- **Trigger**: Push to `main` that changes frontend code (not `data/**`)
- **Ignores**: Changes to `data/**`, `docs/**`, `*.md`
- **What it does**: Deploys entire repo to GitHub Pages at https://louisbgl.github.io/brawl-stats/
- **Why conditional?** Data updates don't require redeploying the site

#### 3. Manual Collection (Backup/Testing)

Can manually trigger any collection:

```bash
# From Oracle VM (SSH)
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 '/home/ubuntu/collect-snapshots.sh'
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 '/home/ubuntu/collect-battlelogs.sh'

# From GitHub Actions (workflow_dispatch)
# Go to Actions tab → Select workflow → Run workflow
```

#### Complete Data Flow

```
Every 30 min:
  Oracle VM (cron) → collect_battlelogs.py → data-battlelogs branch → merge to main
                                                                            ↓
                                                                    GitHub Actions
                                                                            ↓
                                                              generate_achievements.py
                                                                            ↓
                                                                 achievements.json → main

Daily at 23:00 UTC:
  Oracle VM (cron) → collect_data.py → data-snapshots branch → merge to main
                                                                      ↓
                                                              GitHub Actions
                                                                      ↓
                                                        generate_achievements.py
                                                                      ↓
                                                           achievements.json → main

On frontend code change:
  Push to main → GitHub Actions → Deploy to GitHub Pages
```

## Important Implementation Details

### Adding Clubs or Players
Edit `src/config.py`:
```python
CLUBS = [
    {"name": "Club Name", "tag": "#XXXXXXX"},
]

INDIVIDUAL_PLAYERS = [
    {"name": "Player Name", "tag": "#XXXXXXX"},
]
```

### Battle Log Storage

Battle logs are stored separately from daily snapshots, in `data/battlelogs/{TAG}.json` (one file per player). Each file is a JSON list of raw API battle items sorted oldest → newest by `battleTime`. This format is intentionally raw so the data survives model changes.

To update all tracked players' battle logs manually:
```python
# in test_api.py playground
update_all_battlelogs()
```

Battle log data models live in `src/battle_models.py`. The `won` field on `BattleEntry` is inferred from `trophy_change` (positive = win, negative = loss, zero = undetermined/friendly). This is a simplification that can be refined later.

### Data Snapshot Format
- Each snapshot contains: `date`, `timestamp`, `clubs[]`, `individual_players[]`
- Players include: tag, name, trophies, victories (3v3/solo/duo), exp_level, brawlers[]
- Brawlers store: name, power, trophies, rank, and only IDs for gadgets/star powers/hypercharges/gears/prestige
- Frontend resolves item names by looking up IDs in `brawlers.json`

### Historical Data Loading
JavaScript loads all daily snapshots from `data/YYYY-MM-DD.json` starting from hardcoded start date (2026-03-14) in `js/data.js:22`. Update this date if you need to change the historical range.


## Technology Stack

- **Backend**: Python 3.12 with dataclasses, requests, python-dotenv (managed by uv)
- **Frontend**: Vanilla JavaScript (ES6), Chart.js for visualizations
- **Automation**: Oracle Cloud VM cron jobs + GitHub Actions
- **Deployment**: GitHub Pages (automatic on frontend code changes)

## Documentation Files

**IMPORTANT**: This project maintains minimal documentation. Only create new `.md` files for:
- Permanent architectural decisions
- Critical infrastructure setup (like VM configuration)
- Essential design patterns that future AI instances must understand

DO NOT create:
- Temporary analysis documents
- Refactoring summaries (unless they introduce permanent patterns)
- Implementation notes (put those in code comments)
- General how-to guides (put in this file or code comments)

### Current Documentation
- **`CLAUDE.md`** (this file): Complete project reference for AI-assisted development
- **`README.md`**: Project overview and quickstart for humans
- **`docs/FRONTEND_SPEC.md`**: Frontend feature specifications and design
- **`docs/ORACLE_CLOUD_VM.md`**: Oracle Cloud VM management (SSH, services, cron jobs, troubleshooting)
