# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working with Frontend Code

**When making JS/HTML/CSS changes:**

1. **No commentary between edits** - User can't review/help with frontend changes in real-time
2. **Execute edits directly** - Make all necessary changes without explaining each step
3. **Summarize at end** - State what should be working after all changes complete
4. **Ask first if ambiguous** - When logic unclear or request confusing, clarify before starting

**Example:**
```
User: "badges should be next to brawler name"
Bad: "I'll edit battles.js to move badge... Now I'll update CSS... Let me fix positioning..."
Good: [Makes all edits] "Badge now positioned inline with brawler name, vertically centered when multiple players."
```

## Git Commit Guidelines

**CRITICAL - Follow these rules for ALL commits:**

1. **NEVER add Co-Authored-By lines** - No co-author attribution in commits
2. **Small, focused commits** - Each commit should do ONE thing
3. **Concise commit messages** - Brief subject line, minimal body if needed
4. **No emoji or special formatting** - Plain text only

Example of a GOOD commit:
```
Add battle deduplication logic

Deduplicate battles by (battleTime, mode) key.
```

Example of a BAD commit:
```
Refactor entire aggregation pipeline with multiple modules and features

- Extract battle_flattening.py
- Add battles.py
- Refactor club_stats.py
- Update player_stats.py
- Fix achievement dates
... (20 more bullet points)

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

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

**⚠️ V2 NOT YET DEPLOYED:** This branch prepares architecture replacement for main. Current production (main branch) runs v1. VM still uses v1 collection scripts. See `docs/V2_PROMOTION.md` for deployment procedure.

### Data Flow (V2 Architecture)

```
Collection → Raw Storage (compressed) → Data Branches → Aggregation → Frontend
   (VM)         data/raw/*.gz              (merge to main)  (GitHub Actions)  data/aggregated/*.json
```

1. **Collection**: VM runs `collect_snapshots_v2.py` (daily) and `collect_battlelogs_v2.py` (every 30min)
2. **Raw Storage**: Compressed gzip files in `data/raw/snapshots/*.json.gz` and `data/raw/battlelogs/*.json.gz`
3. **Data Branches**: Collection pushes to `data-snapshots` or `data-battlelogs` branches, then merges to main (same strategy as v1)
4. **Aggregation**: GitHub Actions detects `data/raw/**` changes → runs `scripts/aggregate.py` → generates `data/aggregated/**/*.json`
5. **Frontend**: Loads only aggregated JSONs (club-summary, player stats, achievements, battles)

**Why two-tier storage?**
- Raw = complete API responses, compressed (~93% size reduction), historical record
- Aggregated = frontend-optimized, pre-computed stats, fast loading
- Separation allows changing frontend requirements without re-collecting data

**v1 vs v2:**
- **v1** (main): Uncompressed `data/snapshots/*.json`, frontend reads raw snapshots directly
- **v2** (this branch): Compressed `data/raw/**/*.gz`, frontend reads aggregated JSONs only
- **Incompatible**: v1 and v2 frontends cannot mix (different data structures)

---

### Python Backend (Data Collection)

**See `docs/DATA_COLLECTION.md` for complete details.**

**Key points:**
- Collection scripts: `src/collection/collect_snapshots_v2.py` (daily), `collect_battlelogs_v2.py` (every 30min)
- Stores complete API responses, compressed with gzip (~93% reduction)
- Raw data at `data/raw/**/*.gz`, aggregated at `data/aggregated/**/*.json`
- Aggregation via `scripts/aggregate.py` (see `docs/DATA_FLOW.md` for schema)
- Design principle: Collection NEVER fails due to git - raw data always saved first

### JavaScript Frontend (Visualization)

**See `docs/V2_FRONTEND.md` for complete architecture details.**

**Key gotchas when working with frontend:**

**URL state management:**
- Use `window.history.replaceState(null, '', '#...')` to update URL without re-render
- NEVER use `window.location.hash = '...'` while on same tab (causes scroll to top)
- Always validate URL params against current data (player could have left club)

**Display formatting:**
- ALWAYS use `GameConfig.getModeName(mode)` - never show raw strings like `"brawlBall"`
- ALWAYS use `GameConfig.formatRank()`, `formatRankColored()` for ranks
- ALWAYS use `GameConfig.formatTrophyColored()` for trophies
- Check `src/frontend/js/common.js` before implementing any formatting

**State persistence:**
- Save to BOTH localStorage AND URL on every change
- URL takes precedence, localStorage is fallback
- Validate both sources (data changes between sessions)

**Chart.js:**
- Always destroy before re-rendering: `if (chart) chart.destroy();`
- Save/restore hidden dataset state (player visibility toggles)
- Use `update('none')` for immediate updates without animation

**Module load order:**
- `common.js` first (GameConfig used everywhere)
- `data.js` second (DataLoader)
- Tab modules third
- `router.js` and `app.js` last

### Data Collection & Automation Pipeline

Data collection is automated using a multi-layered approach combining Oracle Cloud VM cron jobs, Git branching, and GitHub Actions:

---

## 🚨 CRITICAL: Data Collection Incident History & Lessons Learned

**Incident Count:** 4 occurrences (March-April 2026)

**Root Cause:** Merge conflicts between `data-snapshots` and `data-battlelogs` branches blocked automatic data collection pushes to main. Data was collected successfully but stuck on feature branches.

**Key Design Decisions (April 17, 2026):**

1. **Data Collection is SACRED** - Collection must NEVER fail due to git state
   - Python scripts run regardless of git lock availability
   - If git lock unavailable → data saved locally on VM (manual recovery possible)
   - Scripts use 10-second lock timeout (not 5 minutes) to avoid blocking data collection

2. **Folder Structure (V2)**
   - Raw data (compressed): `data/raw/snapshots/*.gz`, `data/raw/battlelogs/*.gz`
   - Aggregated data: `data/aggregated/**/*.json` (frontend-optimized)
   - Clear separation: raw vs derived, snapshots vs battlelogs
   - **Benefit:** File ownership prevents merge conflicts

3. **Branch File Ownership (Zero Overlap)**
   - `data-snapshots` branch: ONLY tracks `data/raw/snapshots/`
   - `data-battlelogs` branch: ONLY tracks `data/raw/battlelogs/`
   - Branches never merge FROM main (no sync step that causes conflicts)
   - **Benefit:** Merge conflicts physically impossible when files don't overlap

4. **File Locking for Concurrent Execution**
   - Both scripts use `/tmp/brawl-stats-git.lock` (flock)
   - 10-second timeout for git operations
   - If lock fails: data collection proceeds, git operations skipped
   - **Benefit:** Race conditions handled gracefully, data never lost

5. **Automatic Conflict Resolution**
   - If merge conflict occurs (rare now): auto-resolve by file ownership
   - Snapshots merge: keep all `data/raw/snapshots/`, preserve main's battlelogs
   - Battlelogs merge: keep all `data/raw/battlelogs/`, preserve main's snapshots
   - **Benefit:** No manual intervention required

**Recovery Procedure (if data stuck on branches):**
```bash
# Snapshots stuck
git fetch origin data-snapshots:data-snapshots
git checkout origin/data-snapshots -- data/raw/snapshots/YYYY-MM-DD.json.gz
git checkout origin/data-snapshots -- data/aggregated/
git commit -m "Recover snapshot + aggregated from data-snapshots branch"

# Battlelogs stuck
git fetch origin data-battlelogs:data-battlelogs
git checkout origin/data-battlelogs -- data/raw/battlelogs/
git commit -m "Recover battlelogs from data-battlelogs branch"
```

**Testing Done:**
- ✅ Concurrent execution (both scripts simultaneously) - serializes correctly
- ✅ Git lock unavailable - data still collected and saved locally
- ✅ Merge conflicts - auto-resolved by file ownership rules
- ✅ Simulated failures at each stage - data preserved

**What NOT to do:**
- ❌ Never add sync/merge FROM main in collection scripts (causes conflicts)
- ❌ Never exit script before data collection if git fails
- ❌ Never use long lock timeouts that block data collection
- ❌ Never store both snapshot and battlelog data in same branch

---

#### 1. Oracle Cloud VM - Automated Collection (Primary)

The Oracle Cloud VM at `129.151.245.132` runs two automated collection tasks via cron (see `docs/ORACLE_CLOUD_VM.md` for details):

**Daily Profile Snapshots (v2):**
- **Schedule**: 23:00 UTC daily (midnight CET winter / 1am CEST summer)
- **Script**: `/home/ubuntu/collect-snapshots.sh` (will be updated on v2 deployment)
- **Workflow**:
  1. **Try to acquire git lock** (10s timeout)
  2. If locked → checkout `data-snapshots` branch, pull latest
  3. **Run `collect_snapshots_v2.py`** (player profiles, trophies, brawlers) - **ALWAYS RUNS**
  4. Save to `data/raw/snapshots/YYYY-MM-DD.json.gz` (compressed)
  5. If locked → commit raw snapshots, push to `data-snapshots` branch
  6. If locked → merge to `main` with auto-conflict resolution
  7. If NO lock → data saved locally, manual push needed
- **Logs**: `/home/ubuntu/collect-snapshots.log`
- **Resilience**: Data collection NEVER fails due to git. Worst case: data on VM disk
- **Note**: VM does NOT run aggregation. GitHub Actions handles that after merge to main.

**Battlelog Collection (v2):**
- **Schedule**: Every 30 minutes
- **Script**: `/home/ubuntu/collect-battlelogs.sh` (will be updated on v2 deployment)
- **Workflow**:
  1. **Try to acquire git lock** (10s timeout)
  2. If locked → checkout `data-battlelogs` branch, pull latest
  3. **Run `collect_battlelogs_v2.py`** (recent battle history) - **ALWAYS RUNS**
  4. Save to `data/raw/battlelogs/{TAG}.json.gz` (compressed, one file per player)
  5. If locked → commit battlelog files, push to `data-battlelogs` branch
  6. If locked → merge to `main` with auto-conflict resolution
  7. If NO lock → data saved locally, manual push needed
- **Logs**: `/home/ubuntu/collect-battlelogs.log`
- **Resilience**: Data collection NEVER fails due to git. Worst case: data on VM disk
- **Note**: Triggers aggregation on main (GitHub Actions detects data/raw changes)

**Why separate branches with zero file overlap?**
- **Merge conflicts physically impossible** when files don't overlap
- Each branch owns specific files exclusively
- File locking prevents concurrent git operations (serializes)
- Auto-merge ensures `main` always has latest data (when git available)

**Script Design Philosophy:**
Both collection scripts follow the **"DATA FIRST, GIT SECOND"** principle:
1. Data collection ALWAYS runs (Python scripts execute regardless of git state)
2. Git operations are optional optimizations (commit/push/merge)
3. Lock timeout is SHORT (10s) to avoid blocking data collection
4. If git fails → data preserved on VM disk → manual recovery possible
5. **NO data loss is acceptable, git failures are tolerable**

**🚨 CRITICAL CONSTRAINT - READ THIS:**

**Brawl Stars data is EPHEMERAL and CANNOT be backfilled:**
- The Brawl Stars API only returns **current state** (player trophies, wins, brawler levels NOW)
- There is **NO historical API** - you cannot fetch "what were the trophies on April 15?"
- Battle logs have limited history (~25 recent battles, older ones disappear)
- **If we miss a daily snapshot, that day's data is LOST FOREVER**
- **If we miss battlelog collections, those battles are LOST FOREVER**

This is why the "DATA FIRST, GIT SECOND" principle exists. Git problems are recoverable. Data loss is permanent.

**Current Issue (April 2026):**
The scripts can fail to commit data when git lock is unavailable, but the files get lost on next branch checkout/reset. The script says "data saved locally" but it's not truly persistent - it gets cleaned up by `git reset --hard` and `git clean -fd` commands.

**What must be fixed:**
- Data files must be saved to a PERSISTENT location outside the git working directory when git lock fails
- Or: git operations should NEVER run cleanup commands that delete uncommitted data files
- Or: retry logic to commit the data when lock becomes available

#### 2. GitHub Actions - Aggregation & Deployment

**Aggregation** (v2, to be created):
- Runs `scripts/aggregate.py` when `data/raw/**` changes
- Generates `data/aggregated/**/*.json` (frontend-optimized data)
- Current v1 workflow broken on v2 branch (references missing file)

**GitHub Pages**:
- Deploys on frontend code changes (ignores `data/**`)

#### 3. Manual Collection

See `docs/ORACLE_CLOUD_VM.md` for SSH commands and troubleshooting.

## Quick Reference

### Adding Tracked Players

Edit `src/collection/config.py`:
```python
CLUBS = [{"name": "Club Name", "tag": "#XXXXXXX"}]
INDIVIDUAL_PLAYERS = [{"name": "Player Name", "tag": "#XXXXXXX"}]
```

### Data Structure

**Raw** (`data/raw/**/*.gz`): Complete API responses, compressed
**Aggregated** (`data/aggregated/**/*.json`): Frontend-optimized derived data

See `docs/DATA_FLOW.md` for complete aggregated schema.


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
- **`CLAUDE.md`** (this file): Project overview, key gotchas, how to work in this codebase
- **`README.md`**: Project overview for humans
- **`docs/DATA_COLLECTION.md`**: Python backend architecture, collection scripts, modules, data philosophy
- **`docs/V2_FRONTEND.md`**: Frontend architecture, tab specs, patterns, common mistakes
- **`docs/DATA_FLOW.md`**: Aggregated data schema (what frontend expects from aggregation)
- **`docs/V2_PROMOTION.md`**: v1→v2 deployment procedure
- **`docs/ORACLE_CLOUD_VM.md`**: VM management, SSH access, cron jobs, troubleshooting
