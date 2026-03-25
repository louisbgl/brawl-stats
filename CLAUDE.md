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

**Module Structure:**
- `js/data.js`: DataManager singleton - loads and caches latest.json, historical snapshots, and brawlers.json reference
- `js/app.js`: Main application logic, tab switching, and initialization
- `js/charts.js`: ChartsManager - creates timeline charts (trophies, wins, collection, maxed brawlers, prestige)
- `js/player-stats.js`: Individual player detailed stats display
- `js/player-charts.js`: Per-player charts and visualizations
- `js/config.js`: Frontend configuration constants

**Key Features:**
- **Club Overview Tab**: Trophy timeline chart + quick stats for all members
- **Player Stats Tab**: Detailed individual analysis with prestige tracking, power distribution, per-brawler breakdown (shows missing gadgets/star powers/hypercharges)
- **Timelines Tab**: Historical progression charts for trophies, wins (3v3/solo/duo), collection, maxed brawlers, prestige levels
- **Interactive Filtering**: Toggle between overall stats and specific brawlers/gamemodes

### GitHub Actions Workflow

**File**: `.github/workflows/collect-data.yml`

**Triggers:**
- Daily at 23:00 UTC (midnight CET in winter)
- Manual workflow_dispatch
- Push to master affecting collection code

**Steps:**
1. Checkout repository
2. Setup Python 3.12 and uv
3. Install dependencies with `uv sync`
4. Run `uv run collect_data.py` with proxy URL from secrets
5. Commit and push changes to data/ folder (handles merge conflicts with rebase)

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

### Proxy Service
The `proxy/` directory contains a standalone Flask app that:
- Provides a static IP endpoint for the Brawl Stars API (GitHub Actions IPs change)
- Deployed separately (Railway/Oracle Cloud) - see `docs/PROXY_DEPLOYMENT.md`
- Accepts all `/<path>` requests and forwards to `https://api.brawlstars.com/v1/<path>`
- Adds authentication header from environment variable

## Technology Stack

- **Backend**: Python 3.12 with dataclasses, requests, python-dotenv (managed by uv)
- **Frontend**: Vanilla JavaScript (ES6), Chart.js for visualizations
- **Automation**: GitHub Actions (daily cron + manual trigger)
- **Deployment**: GitHub Pages (automatic on push to main)
- **Proxy**: Flask on Oracle Cloud Free Tier VM

## Documentation Files

- `docs/FRONTEND_SPEC.md`: Detailed feature specifications for the web dashboard
- `docs/ORACLE_CLOUD_VM.md`: Proxy server setup guide
- `docs/PROXY_DEPLOYMENT.md`: Proxy deployment instructions
- `proxy/README.md`: Proxy service documentation
