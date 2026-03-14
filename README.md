# Brawl Stars Club Tracker

Daily statistics tracker for Brawl Stars club members with historical trend analysis.

## Features

- **Daily Data Collection**: Automated snapshot of all club members' stats
- **Compact Storage**: ID-based system (~288KB per daily snapshot)
- **Historical Tracking**: Trophy progression, brawler collection, item acquisition over time
- **Web Dashboard**: GitHub Pages hosted stats viewer (coming soon)

## Data Structure

```
data/
├── brawlers.json        # Reference data (all brawlers, items, IDs)
├── latest.json          # Most recent snapshot
└── YYYY-MM-DD.json      # Daily snapshots
```

## Setup

### 1. Clone the repository

```bash
git clone git@github.com:louisbgl/brawl-stats.git
cd brawl-stats
```

### 2. Install dependencies

This project uses [uv](https://github.com/astral-sh/uv) for Python package management:

```bash
# Install uv if you don't have it
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install project dependencies
uv sync
```

### 3. Configure API token

Get your Brawl Stars API token from https://developer.brawlstars.com

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your token
# BRAWL_STARS_API_TOKEN=your_token_here
```

### 4. Configure tracked clubs/players

Edit `src/config.py` to add your clubs or individual players:

```python
CLUBS = [
    {
        "name": "Your Club Name",
        "tag": "#CLUBTAG",
    },
]

INDIVIDUAL_PLAYERS = [
    # Optional: track players not in clubs
    # {
    #     "name": "Player Name",
    #     "tag": "#PLAYERTAG",
    # },
]
```

### 5. Run data collection

```bash
uv run collect_data.py
```

## GitHub Actions Setup

The repository uses GitHub Actions to automatically collect data daily.

### Required Secret

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `BRAWL_STARS_API_TOKEN`
4. Value: Your Brawl Stars API token

### Important: IP Whitelisting

⚠️ **GitHub Actions uses dynamic IPs** - If your Brawl Stars API token is IP-restricted, the workflow will fail.

**Solutions:**
1. Create a new API token without IP restrictions (recommended for automation)
2. Or use a self-hosted runner with a static IP

### Workflow Triggers

- **Daily**: Runs at midnight UTC
- **Manual**: Click "Run workflow" in the Actions tab
- **On Push**: Automatically tests when code changes

## Branch Protection (Recommended)

To require reviews for pull requests:

1. Go to **Settings** → **Branches**
2. Add rule for `master` branch
3. Enable:
   - ✅ Require pull request before merging
   - ✅ Require approvals (1 approval)
   - ✅ Require review from Code Owners

## Development

### Project Structure

```
brawl-stats/
├── src/
│   ├── api.py           # Brawl Stars API client
│   ├── config.py        # Configuration (clubs, players, constants)
│   └── models.py        # Data models (snapshots)
├── collect_data.py      # Main collection script
├── data/                # Generated data (committed to git)
└── .github/
    └── workflows/       # GitHub Actions automation
```

### Adding Features

1. Create a feature branch
2. Make changes
3. Test locally with `uv run collect_data.py`
4. Push and create a pull request
5. Wait for code review approval

## File Sizes

- Daily snapshot: ~288 KB (7 members)
- Brawlers reference: ~118 KB
- Yearly storage: ~102 MB (365 days)

## Tech Stack

- **Data Collection**: Python 3.12 + uv
- **Storage**: JSON files (git tracked)
- **Automation**: GitHub Actions
- **Frontend**: HTML + JavaScript + Chart.js (coming soon)
- **Hosting**: GitHub Pages (coming soon)

## License

MIT

---

🤖 Built with [Claude Code](https://claude.com/claude-code)
