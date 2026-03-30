# Brawl Stars Club Tracker

Automated statistics tracker for Brawl Stars club members with real-time battle tracking, daily snapshots, and interactive visualizations.

**Live Dashboard:** https://louisbgl.github.io/brawl-stats/

## Features

### Data Collection
- **Daily Snapshots:** Automated collection via cron job at midnight CET (trophies, brawlers, items)
- **Battle Tracking:** Hourly battlelog collection (every 30 minutes) for detailed performance metrics
- **Achievement Detection:** Automatic milestone tracking on every data update
- **Historical Data:** Complete retention of all snapshots since inception

### Dashboard (4 Tabs)
- **Club Overview:** Trophy timeline, quick stats, club leaderboards (Grind King, Best Win Rate, Star Player, Hot Streak)
- **Player Stats:** Detailed individual analysis with prestige tracking, power distribution, brawler details, battle performance, teammate chemistry, activity heatmap
- **Timelines:** Historical progression charts for trophies, wins, collection, maxed brawlers, prestige levels, activity, and mode popularity
- **Achievements:** Milestone timeline feed with 9 types of achievements (new brawlers, maxed brawlers, items, prestiges, trophy milestones)

### Performance & UX
- **Fast Loading:** <500ms initial load with 3-phase architecture (critical → background → on-demand)
- **URL Routing:** Shareable URLs for tabs and players (`#/overview`, `#/player/TAG`)
- **Mobile Optimized:** Horizontal scrollable tabs, touch-friendly interface
- **Interactive Filtering:** Search, sort, and filter across all views

## Quick Start

### Local Development

```bash
# Clone the repository
git clone https://github.com/louisbgl/brawl-stats.git
cd brawl-stats

# Install dependencies
uv sync

# Run local server
python3 -m http.server 8000
```

Visit `http://localhost:8000` in your browser.

### Data Collection Setup

1. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your proxy URL or API token
   ```

2. Add your clubs and players in `src/config.py`:
   ```python
   CLUBS = [{"name": "Club Name", "tag": "#XXXXXXX"}]
   INDIVIDUAL_PLAYERS = [{"name": "Player Name", "tag": "#XXXXXXX"}]
   ```

3. Run manually:
   ```bash
   # Collect daily snapshot
   uv run python collect_data.py

   # Generate achievements
   uv run python generate_achievements.py
   ```

**Automated Collection:**
- Daily snapshots: Cron job on Oracle Cloud VM at midnight CET
- Battlelog updates: Cron job every 30 minutes
- Achievements generation: GitHub Actions workflow on every push to main

## Project Structure

```
├── data/
│   ├── YYYY-MM-DD.json           # Daily snapshots
│   ├── latest.json                # Most recent snapshot
│   ├── brawlers.json              # Game reference data
│   ├── achievements.json          # Milestone timeline
│   └── battlelogs/{TAG}.json      # Per-player battle history
├── src/
│   ├── api.py                     # Brawl Stars API client
│   ├── models.py                  # Daily snapshot dataclasses
│   ├── battle_models.py           # Battle log dataclasses
│   ├── battle_store.py            # Battle log persistence
│   ├── config.py                  # Configuration
│   └── collect_data.py            # Main collection script
├── js/
│   ├── app.js                     # Main initialization
│   ├── router.js                  # URL routing
│   ├── data.js                    # Data loading manager
│   ├── battlelog-data.js          # Battle data manager
│   ├── charts.js                  # Timeline charts
│   ├── player-stats.js            # Player detail views
│   └── achievements.js            # Achievement feed
├── css/styles.css                 # Dashboard styles
├── docs/                          # Documentation
├── generate_achievements.py       # Achievement detection
└── index.html                     # Main dashboard
```

## Documentation

- **[Frontend Specification](docs/FRONTEND_SPEC.md)** - Complete feature details, tab breakdown, performance optimizations
- **[Oracle Cloud VM Setup](docs/ORACLE_CLOUD_VM.md)** - Proxy server configuration
- **[Proxy Deployment](docs/PROXY_DEPLOYMENT.md)** - Proxy service setup guide

## Tech Stack

**Backend (Python 3.12):**
- Data collection: `requests`, `dataclasses`, `python-dotenv`
- Package manager: `uv`
- API: Brawl Stars official API (via proxy)

**Frontend:**
- Vanilla JavaScript (ES6 modules)
- Chart.js for visualizations
- Hash-based routing with History API
- 3-phase loading architecture (critical → background → lazy)

**Infrastructure:**
- **Data Collection:** Cron jobs on Oracle Cloud VM (daily + hourly battlelog)
- **Achievement Generation:** GitHub Actions workflow (on push to main)
- **Deployment:** GitHub Pages (auto-deploy on push)
- **Proxy:** Flask on Oracle Cloud Free Tier VM (static IP for API access)

**Data Storage:**
- Daily snapshots: JSON files in `data/` (kept forever)
- Battlelog: Per-player JSON files in `data/battlelogs/`
- Reference data: `brawlers.json` (game items catalog)

## Key Implementation Details

### Data Collection
- **Snapshots:** Complete player state captured daily (trophies, brawlers, items, power levels)
- **Battlelog:** Last 25 battles per player collected every 30 minutes (deduped by `battleTime`)
- **Achievements:** Generated by comparing consecutive snapshots to detect milestones
- **Reference Data:** Brawlers catalog cached and updated daily

### Frontend Architecture
- **Smart Loading:** Only critical data (`latest.json`, `brawlers.json`) loads before first render
- **Background Loading:** Historical snapshots and battlelog load via `requestIdleCallback()`
- **Lazy Initialization:** Timeline charts and achievements only render when tab is viewed
- **URL Routing:** Hash-based routing enables shareable URLs and browser navigation

### Achievement Detection (9 Types)
1. New Brawler - Unlocked a new brawler
2. Maxed Brawler - P11 + 2 gadgets + 2 star powers + hypercharge
3. Gadget/Star Power/Hypercharge - Unlocked specific items
4. Prestige - Every 1000 trophy milestone per brawler (1, 2, 3...)
5. Trophy Milestone - Every 10k total trophies (10k, 20k, 30k...)
6. First Prestige Level - First brawler to reach P2-P7
7. Total Prestiges - Accumulated prestiges across all brawlers (every 10)

## Development Philosophy

The entire frontend is AI-generated and not manually reviewed. This enables:
- Rapid iteration and refactoring
- Clean, maintainable code structure
- No technical debt from legacy decisions
- Continuous improvement based on user feedback

## License

MIT
