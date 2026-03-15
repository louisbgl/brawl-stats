# Brawl Stars Club Tracker

Automated statistics tracker for Brawl Stars club members with daily data collection and visualization.

**Live Dashboard:** https://louisbgl.github.io/brawl-stats/

## Features

- **Daily Data Collection:** Automated snapshots via GitHub Actions at midnight CET
- **Club Overview:** Trophy timelines and quick stats across all members
- **Player Stats:** Detailed individual analysis with prestige tracking, power distribution, and brawler details
- **Timeline Charts:** Track progression over time for trophies, wins, collection, maxed brawlers, and prestige levels
- **Interactive Filtering:** Toggle between overall stats and specific brawlers/gamemodes

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

2. Add your clubs in `src/config.py`

3. Run manually:
   ```bash
   uv run python collect_data.py
   ```

GitHub Actions handles automated daily collection at midnight CET.

## Project Structure

```
├── data/              # JSON snapshots (YYYY-MM-DD.json)
├── src/               # Python data collection code
├── js/                # Frontend JavaScript modules
├── css/               # Styles
├── docs/              # Documentation
└── index.html         # Main dashboard
```

## Documentation

- [Oracle Cloud VM Setup](docs/ORACLE_CLOUD_VM.md) - Proxy server configuration
- [Frontend Specification](docs/FRONTEND_SPEC.md) - Feature details

## Tech Stack

- **Backend:** Python with dataclasses, requests
- **Frontend:** Vanilla JavaScript, Chart.js
- **Automation:** GitHub Actions
- **Deployment:** GitHub Pages
- **Proxy:** Flask on Oracle Cloud Free Tier

## License

MIT
