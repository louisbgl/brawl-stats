# Data Collection Architecture (V2)

**Status**: Not yet deployed. VM runs v1 collection scripts. V2 scripts ready but awaiting promotion to main.

---

## Overview

**Purpose**: Fetch player profiles and battle logs from Brawl Stars API, compress, save to `data/raw/`

**Key difference from v1**: Compression with gzip (~93% size reduction)

**Design principle**: Collection NEVER fails due to git issues. Raw data always saved first, git operations optional.

---

## Collection Scripts

### Snapshot Collection (`src/collection/collect_snapshots_v2.py`)

**Runs**: Daily at 23:00 UTC (via VM cron)

**Fetches**:
- All tracked players (club members + individual friends)
- Full player profiles (trophies, victories, exp, brawlers)
- Complete brawler data (power, trophies, items with IDs)

**Output**: `data/raw/snapshots/YYYY-MM-DD.json.gz`

**Format**:
```json
{
  "date": "2026-08-31",
  "timestamp": "2026-08-31T23:00:15Z",
  "clubs": [
    {
      "tag": "#2L0U0PGRL",
      "name": "JOEL Club",
      "members": [...]  // Full API response per member
    }
  ],
  "individual_players": [...]  // Full API response per player
}
```

**No filtering**: Complete API responses preserved (future-proof)

---

### Battlelog Collection (`src/collection/collect_battlelogs_v2.py`)

**Runs**: Every 30 minutes (via VM cron)

**Fetches**:
- Recent ~20 battles per tracked player
- Battle API returns battles sorted newest → oldest

**Output**: `data/raw/battlelogs/{TAG}.json.gz` (one file per player)

**Format**: Array of raw API battle items, sorted oldest → newest
```json
[
  {
    "battleTime": "20260826T134521.000Z",
    "event": {
      "id": 12345,
      "mode": "brawlBall",
      "map": "Sneaky Fields"
    },
    "battle": {
      "mode": "ranked",
      "type": "ranked",
      "rank": null,
      "trophyChange": 8,
      "teams": [[...], [...]]
    }
  },
  ...
]
```

**Deduplication**: By `battleTime` - no duplicate battles stored

**History limit**: API only returns ~20 recent battles (older ones disappear)

---

## Core Modules

### `src/collection/api.py`

**Brawl Stars API client**

**Key function**: `api_call(endpoint)`
- Auto-encodes `#` in tags (`#ABC123` → `%23ABC123`)
- Handles both direct API and proxy modes
- Caches brawlers reference data indefinitely

**Configuration**:
- Direct mode: `BRAWL_STARS_API_TOKEN` in `.env`
- Proxy mode: `BRAWL_STARS_PROXY_URL` in `.env`

**Proxy**: Flask app (`proxy/main.py`) provides static IP for VM/GitHub Actions

---

### `src/collection/models.py`

**Snapshot data structures**

Simple wrappers that add metadata to raw API responses:
```python
def create_daily_snapshot(date, timestamp, clubs, individual_players):
    """Wraps raw API responses with metadata"""
    return {
        "date": date,
        "timestamp": timestamp,
        "clubs": clubs,  # Raw API response
        "individual_players": individual_players  # Raw API response
    }
```

**Philosophy**: Store complete API responses, no filtering, no transformation

---

### `src/collection/battle_models.py`

**Battle log data structures**

**Comprehensive mode/type documentation**:

**Battle types** (4 total):
1. `ranked` - Ladder/trophy system, has `trophyChange`
2. `soloRanked` - Competitive ranked (ELO-based), brawlers at 1-16 trophies
3. `friendly` - Casual matches, no trophies
4. `challenge`/`championshipChallenge` - Event battles

**Game modes** (15+ total, 4 categories):

**Team 3v3**: `gemGrab`, `brawlBall`, `bounty`, `heist`, `hotZone`, `knockout`, `siege`, `wipeout`, `brawlArena`, `airHockey`, `tagTeam`

**Team 5v5**: `brawlBall5V5`, `wipeout5V5`, `knockout5V5`, `deathmatch5v5`

**Showdown**: `soloShowdown`, `duoShowdown`, `trioShowdown`

**Special**: `duels`, `lastStand`, `megaBoss`

**Helper methods**:
- `is_team_mode()` - Returns True for 3v3 or 5v5
- `is_showdown_mode()` - Returns True for soloShowdown/duoShowdown/trioShowdown
- `is_duels_mode()` - Returns True for duels
- `is_pve_mode()` - Returns True for lastStand/megaBoss

**Special cases**:

**Duels**:
- 1v1 mode where each player uses 3 brawlers
- Each brawler has individual `trophyChange`
- Total trophy change = sum of 3 brawlers

**lastStand** (PvE):
- No `trophyChange` (not a competitive mode)
- Win/loss determined differently

---

### `src/collection/battle_store_v2.py`

**Compressed battle log storage**

**Key functions**:
- `update(tag)` - Fetch new battles from API, dedupe, compress, save
- `load_raw(tag)` - Load decompressed battles from file

**Storage**: `data/raw/battlelogs/{TAG}.json.gz`

**Deduplication**: By `battleTime` (unique timestamp per battle)

**Sorting**: Oldest → newest (API returns newest → oldest, reversed on save)

---

### `src/collection/config.py`

**Configuration management**

**Tracked entities**:
```python
CLUBS = [
    {"name": "JOEL Club", "tag": "#2L0U0PGRL"},
]

INDIVIDUAL_PLAYERS = [
    {"name": "Player Name", "tag": "#XXXXXXXX"},
]
```

**API credentials**: Loaded from `.env` via python-dotenv

**Game constants**: Prestige thresholds, upgrade costs, etc.

---

## Compression Details

**Algorithm**: gzip (Python `gzip` module)

**Compression ratio**: ~93% size reduction

**Example**:
- Uncompressed snapshot: ~500KB
- Compressed snapshot: ~35KB

**Trade-off**: Slightly slower read/write, but massively reduces repo size

**Future**: Consider zstd for better compression/speed balance

---

## Data Philosophy

### Complete API Responses

**Why store everything?**
- Future-proof: New API fields automatically captured
- No need to predict what frontend will need
- Aggregation can extract different data without re-collection

**Example**: API adds new brawler stat tomorrow → automatically in raw data → aggregation can use it immediately

---

### Raw vs Aggregated Separation

**Raw** (`data/raw/**/*.gz`):
- Complete API responses
- Compressed for storage efficiency
- Never modified after creation
- Historical record

**Aggregated** (`data/aggregated/**/*.json`):
- Frontend-optimized derived data
- Pre-computed stats
- Can be regenerated from raw data at any time
- Changes when frontend needs change

**Benefit**: Changing frontend requirements doesn't require re-collecting data (just re-aggregate)

---

## Collection Workflow (VM)

**Current (v1)**:
1. VM cron triggers `collect-snapshots.sh`
2. Script calls `collect_data.py` (v1)
3. Saves to `data/snapshots/YYYY-MM-DD.json` (uncompressed)
4. Commits to `data-snapshots` branch, merges to main

**Future (v2, after deployment)**:
1. VM cron triggers `collect-snapshots.sh`
2. Script calls `collect_snapshots_v2.py`
3. Saves to `data/raw/snapshots/YYYY-MM-DD.json.gz` (compressed)
4. Commits to `data-snapshots` branch, merges to main
5. GitHub Actions detects change, runs aggregation

**Same for battlelogs**: Every 30min instead of daily

---

## Error Handling

### Git Lock Unavailable

**Scenario**: Another script holds git lock

**Behavior**:
1. Collection script waits max 10 seconds for lock
2. If timeout → skip git operations
3. **Data still saved locally** to disk
4. Manual recovery possible later

**Philosophy**: "DATA FIRST, GIT SECOND" - no data loss acceptable

---

### API Failures

**Scenario**: Brawl Stars API returns error

**Behavior**:
- Script logs error, continues with other players
- Partial data saved (players that succeeded)
- Next collection cycle retries failed players

**Critical**: API has no historical data - missed snapshots = data lost forever

---

## Data Constraints

### Ephemeral API Data

**Critical constraint**: Brawl Stars API has NO historical data

**Snapshots**:
- API returns current state only
- Can't backfill: "What were trophies on April 15?" = impossible
- Missed daily snapshot = that day lost forever

**Battlelogs**:
- API returns ~20 most recent battles
- Older battles disappear from API
- Missed collections = battles lost forever

**Why 30min battlelog frequency**: Minimize risk of missing battles (API limit ~20-25)

---

## Adding Tracked Players

**Edit** `src/collection/config.py`:

```python
# Add to club
CLUBS = [
    {"name": "New Club", "tag": "#NEWTAG"},
]

# Or add individual player
INDIVIDUAL_PLAYERS = [
    {"name": "Friend Name", "tag": "#FRIENDTAG"},
]
```

**Next collection**: New players included automatically

**Backfill**: Not possible (API has no history). Historical data starts from first collection.

---

## API Rate Limits

**Brawl Stars API limits**:
- Unknown exact limits (not publicly documented)
- Conservative approach: 1 request per second
- Proxy helps distribute load

**Current load**:
- ~11 tracked players
- Snapshots: 11 player requests + 1 club request = 12/day
- Battlelogs: 11 player requests every 30min = 528/day
- Total: ~540 API calls/day (well within limits)

---

## Testing Collection Locally

**Manual run**:
```bash
# Setup
cp .env.example .env
# Edit .env with API credentials

# Install dependencies
uv sync

# Run snapshot collection
uv run python src/collection/collect_snapshots_v2.py

# Run battlelog collection
uv run python src/collection/collect_battlelogs_v2.py

# Check output
ls -lh data/raw/snapshots/
ls -lh data/raw/battlelogs/
```

**Verify compression**:
```bash
# Inspect compressed file
uv run python scripts/inspect_compressed.py data/raw/snapshots/2026-08-31.json.gz
```

---

## Migration from V1

**Historical data conversion**: `scripts/sync_from_main.py`

**What it does**:
1. Detects new snapshots/battlelogs on main (v1 format)
2. Extracts data from v1 uncompressed files
3. Compresses to v2 format
4. Saves to `data/raw/`
5. Runs aggregation

**Usage**:
```bash
# Preview changes
python scripts/sync_from_main.py --dry-run

# Execute sync
python scripts/sync_from_main.py --execute
```

**Keeps v2 branch up-to-date** with v1 data collection during development

---

## References

- **Aggregation**: See `docs/DATA_FLOW.md` for what aggregation generates from raw data
- **Deployment**: See `docs/V2_PROMOTION.md` for v1→v2 migration procedure
- **VM management**: See `docs/ORACLE_CLOUD_VM.md` for cron setup and troubleshooting
