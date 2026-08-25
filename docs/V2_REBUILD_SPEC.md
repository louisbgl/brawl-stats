# V2 Rebuild Specification

**Branch:** `v2`
**Status:** Phase 1 Complete, Phase 2 Starting (August 2026)
**Goal:** Fix load times (20s → <3s), reduce repo bloat, maintain clean architecture

**Progress:**
- ✅ Phase 1: Compression (complete)
- 🚧 Phase 2: Aggregation (next)
- ⏸️ Phase 3: Frontend (deferred)

---

## Critical Constraint: Data Collection is Sacred

**MUST preserve at all costs:**
- Daily snapshot collection (23:00 UTC)
- Battlelog collection (every 30 min)
- Both run on Oracle VM, push to `main` branch
- **Brawl Stars API is ephemeral** - missed collection = permanent data loss

**v2 Development Strategy:**
- ALL changes isolated on `v2` branch until complete
- NO merge to `main` until frontend ready to ship
- Collection scripts on `main` remain UNCHANGED during development
- Zero disruption to live data collection system

---

## Current State (August 2026)

**Data volume:**
- 164 daily snapshots (~100 MB raw JSON)
- 11 player battlelogs (~45 MB raw JSON)
- Total: ~145 MB + growing 1 MB/day

**Problems:**
1. Frontend loads 145 MB on every page load (20s on 4G)
2. Repo approaching GitHub 1GB limit (~2 years at current rate)
3. Git operations slow (clones take 30+ seconds)
4. No offline mode (too much data for Service Worker cache)

**What works:**
- Data collection pipeline (Oracle VM + GitHub Actions)
- Achievement generation (post-push on `main`)
- Proxy server for local dev

---

## Phase 1: Compression at Collection

### Objectives

1. **Reduce repo size:** 145 MB → ~18 MB (87% savings)
2. **Reduce daily growth:** 1 MB/day → 80 KB/day
3. **Enable faster aggregation:** Read compressed files (7.8x less I/O)

### Implementation (v2 Branch Only)

**Create v2 collection scripts:**
```
src/collection/
  collect_snapshots.py        # main branch (untouched)
  collect_snapshots_v2.py     # v2 branch (compression)
  collect_battlelogs.py       # main branch (untouched)
  collect_battlelogs_v2.py    # v2 branch (compression)
```

**Key changes in v2 scripts:**
```python
import gzip
import json

def save_snapshot_compressed(data: dict, date: str) -> None:
    """Save snapshot as gzipped JSON."""
    filepath = f"data/raw/snapshots/{date}.json.gz"
    with gzip.open(filepath, 'wt', compresslevel=9) as f:
        json.dump(data, f, separators=(',', ':'))

def load_snapshot_compressed(date: str) -> dict:
    """Load snapshot from gzipped JSON."""
    filepath = f"data/raw/snapshots/{date}.json.gz"
    with gzip.open(filepath, 'rt') as f:
        return json.load(f)
```

**Keep uncompressed:**
- `data/raw/metadata/latest.json` (quick access for debugging)
- `data/raw/metadata/brawlers.json` (small, frequently accessed)

**Migration script** (one-time, v2 branch):
```
scripts/migrate_to_compressed.py
  - Compress all 164 existing snapshots: .json → .json.gz
  - Compress all 11 battlelogs: .json → .json.gz
  - Verify integrity: decompress → SHA256 match
  - Delete originals after verification
```

### Testing (v2 Branch)

```bash
# Run v2 scripts manually (don't deploy to VM yet)
python src/collection/collect_snapshots_v2.py
python src/collection/collect_battlelogs_v2.py

# Verify compression
ls -lh data/raw/snapshots/*.json.gz
du -sh data/raw/

# Test integrity
python scripts/inspect_compressed.py data/raw/snapshots/2026-08-25.json.gz
```

### NO VM Changes During Phase 1

- Oracle VM continues running old scripts
- Pushes to `main` as `.json` (uncompressed)
- v2 branch periodically pulls from `main` (gets new data)
- New files compressed locally on v2 branch via migration script

### Deliverables

- ✅ `src/collection/collect_snapshots_v2.py`
- ✅ `src/collection/collect_battlelogs_v2.py`
- ✅ `src/collection/battle_store_v2.py`
- ✅ `src/aggregation/compression.py` (shared utilities)
- ✅ `scripts/migrate_to_compressed.py`
- ✅ `scripts/inspect_compressed.py` (debugging tool)
- ✅ `.github/workflows/compress-raw.yml` (auto-compress on main)
- ✅ 166 snapshots compressed (9.6 MB)
- ✅ 11 battlelogs compressed (4.1 MB)
- ✅ Integrity tests pass (100% match after decompress)
- ✅ Total: 13.7 MB compressed (was ~100+ MB)

**Status:** Complete (4 commits pushed to v2 branch)

---

## Phase 2: Aggregation Pipeline

### Objectives

1. **Precompute stats:** Generate aggregated data during collection
2. **Reduce frontend load:** 145 MB raw → ~500 KB aggregated
3. **Enable fast UX:** Load time 20s → <3s

### Architecture

**Data flow:**
```
data/raw/ (compressed snapshots + battlelogs)
    ↓
src/aggregation/aggregate.py (reads .json.gz)
    ↓
data/aggregated/ (precomputed stats, uncompressed for frontend)
```

**Output structure:**
```
data/aggregated/
  club-summary.json              (~50 KB)
    - Trophy timeline (all players, daily)
    - Mode popularity (total games by mode)
    - Leaderboards (trophies, prestige, win rate)
    - Activity trends (games per day)

  players/
    {TAG}/
      timeline.json               (~5 KB per player)
        - Daily: trophies, prestige, 3vs3Victories
        - Date range: first tracked → latest

      brawlers.json               (~20 KB per player)
        - Current brawler levels, items owned
        - Missing items for upgrade cost calculations
        - Owned + unowned brawlers

      battle-stats.json           (~10 KB per player)
        - Overall: games, wins, losses, win rate
        - By mode: win rates for each game mode
        - By brawler: win rates per brawler
        - Teammate chemistry: win rates with each club member

      recent-battles.json         (~30 KB, last 50 battles)
        - For battle feed view
        - Expandable details (all participants + stats)

  indexes/
    dates.json                    (~1 KB)
      - Available date range (first → latest)
      - Monthly markers for timeline scrubbing

    players.json                  (~1 KB)
      - Tag → name mapping for all tracked players
      - Current trophies for sorting

  achievements.json               (~200 KB)
    - Move from data/achievements.json
    - Already generated, just relocate
```

### Implementation Modules

**`src/aggregation/aggregate.py`** (main orchestrator)
```python
def main():
    # Load all raw data (compressed)
    snapshots = load_all_snapshots_compressed()
    battlelogs = load_all_battlelogs_compressed()

    # Generate club-wide stats
    generate_club_summary(snapshots, battlelogs)
    generate_indexes(snapshots)

    # Generate per-player stats
    for tag in all_tracked_players():
        generate_player_timeline(tag, snapshots)
        generate_player_brawlers(tag, snapshots[-1])  # latest snapshot
        generate_player_battle_stats(tag, battlelogs[tag])
        generate_recent_battles(tag, battlelogs[tag], limit=50)

    # Move achievements to aggregated folder
    relocate_achievements()
```

**`src/aggregation/club_stats.py`**
- Extract trophy timeline from all snapshots
- Aggregate mode popularity from battlelogs
- Calculate leaderboards (sort players by various metrics)
- Compute activity trends (games per day, 7-day rolling avg)

**`src/aggregation/player_stats.py`**
- Extract daily progression (trophies, prestige, wins)
- Calculate win rates by mode/brawler (handles duels, lastStand, etc.)
- Compute teammate chemistry (shared battles → win rates)
- Identify missing brawler items for upgrade calculations

**`src/aggregation/compression.py`** (shared utilities)
- `save_compressed(data, filepath)` - Save as .json.gz
- `load_compressed(filepath)` - Load from .json.gz
- Used by both collection and aggregation scripts

### Testing (v2 Branch, Local Only)

```bash
# Run aggregation manually (no GitHub Actions yet)
python src/aggregation/aggregate.py

# Verify outputs
du -sh data/aggregated/              # Should be ~5 MB total
cat data/aggregated/club-summary.json | jq
ls -lh data/aggregated/players/2L0U0PGRL/

# Check timeline data
cat data/aggregated/players/2L0U0PGRL/timeline.json | jq '.trophies | length'
# Should match number of snapshots (164+)
```

### NO GitHub Actions During Phase 2

- Run aggregation manually on v2 branch for testing
- No `.github/workflows/aggregate-data.yml` until merge
- Why? Would trigger on `main` branch pushes (interferes with collection)

### Syncing v2 with main

```bash
# Weekly or after major changes on main
git checkout v2
git pull origin main                          # Get new snapshots/battlelogs
python scripts/migrate_to_compressed.py       # Compress new files
python src/aggregation/aggregate.py           # Regenerate aggregated data
git add data/
git commit -m "Sync from main: compress + reaggregate"
```

### Deliverables

- [ ] `src/aggregation/aggregate.py`
- [ ] `src/aggregation/club_stats.py`
- [ ] `src/aggregation/player_stats.py`
- [ ] `src/aggregation/compression.py`
- [ ] `data/aggregated/club-summary.json` generated
- [ ] `data/aggregated/players/{TAG}/` for all 11 players
- [ ] `data/aggregated/indexes/` generated
- [ ] Achievements relocated to `data/aggregated/`
- [ ] Total aggregated size ~5 MB (verified)

---

## Phase 3: Frontend Rebuild

### Objectives

1. **Fast initial load:** <3s on 4G (down from 20s)
2. **Mobile-first UX:** Touch-friendly, responsive, no horizontal scroll
3. **Offline mode:** Service Worker caching for repeat visits (<500ms)

### Technology Choices

**Keep simple:**
- Vanilla JavaScript (ES6 modules, no framework)
- Modern CSS (Grid, Flexbox, CSS variables)
- Chart.js for visualizations (proven, works)

**Why no framework:**
- Personal project (React/Vue overkill for this scale)
- Fast iteration (no compile step, just refresh)
- Small bundle (no framework = faster load)

### File Structure (Proposed)

```
src/frontend/
  index.html                    # Main page

  css/
    main.css                    # Core styles, CSS variables, dark mode
    mobile.css                  # Responsive overrides (<768px)

  js/
    core/
      data-loader.js            # Fetch aggregated data ONLY (never raw)
      router.js                 # Hash-based navigation (#/player/TAG)
      constants.js              # Game constants, mode names, colors

    views/
      overview.js               # Club summary + leaderboards
      player-stats.js           # Per-player deep dive
      timelines.js              # Historical charts (164+ days)
      achievements.js           # Milestone feed
      battles.js                # Battle log viewer

    utils/
      chart-builder.js          # Chart.js wrappers (shared configs)
      formatters.js             # Dates, numbers, "time ago"

  assets/                       # Symlink to ../../assets/
```

### Data Loading Strategy

**3-phase loading:**

1. **Critical (blocking):** Initial page render
   - `data/aggregated/club-summary.json` (~50 KB)
   - `data/aggregated/indexes/players.json` (~1 KB)
   - `data/aggregated/indexes/dates.json` (~1 KB)
   - Total: ~52 KB (loads in <500ms on 4G)

2. **Background (lazy):** Selected player data
   - `data/aggregated/players/{TAG}/timeline.json`
   - `data/aggregated/players/{TAG}/brawlers.json`
   - `data/aggregated/players/{TAG}/battle-stats.json`
   - Total: ~35 KB per player (loads on tab switch)

3. **On-demand (user-triggered):** Heavy views
   - `data/aggregated/players/{TAG}/recent-battles.json` (Battles tab)
   - `data/aggregated/achievements.json` (Achievements tab)
   - Load only when user opens specific tab

**Service Worker caching:**
- Cache all aggregated files on first visit
- Check for updates every 60 seconds
- Show "New data available" banner
- User clicks → fetch updates, refresh UI

### Views (High-Level)

**Overview Tab:**
- Club trophy timeline (Chart.js line, all players)
- Leaderboards (trophies, prestige, win rate, activity)
- Quick stats (total games, avg trophies, mode breakdown)

**Player Stats Tab:**
- Player selector dropdown
- Trophy progression chart (date range filter)
- Brawler breakdown table (searchable, sortable)
- Account Worth card (upgrade costs)
- Battle performance (win rate, recent form)
- Teammate chemistry

**Timelines Tab:**
- Historical charts (164+ days data)
- Trophy progression (all players)
- Win count progression
- Prestige milestones
- Activity trends
- Mode popularity

**Achievements Tab:**
- Chronological feed (newest first)
- Filters: player, achievement type
- Icons for each type (new brawler, prestige, maxed)
- Relative dates ("2 weeks ago")

**Battles Tab:**
- Paginated feed (50 battles per page)
- Filters: player, mode, result (W/L)
- Expandable rows (all participants + stats)
- Battle type indicators (ranked, soloRanked, friendly)

### Mobile UX Improvements

**v1 problems:**
- Tiny tap targets (<30px)
- Horizontal scroll on tables
- Charts overflow on small screens
- No touch gestures

**v2 solutions:**
- 44px minimum tap targets (Apple HIG standard)
- Responsive tables (stack on mobile, contained scroll)
- Charts use `responsive: true, maintainAspectRatio: false`
- Swipe gestures for tab navigation
- Bottom nav bar on mobile (thumb-friendly)

### Performance Targets

| Metric | Target |
|--------|--------|
| Initial load (4G) | <3s |
| Repeat visit (cache) | <500ms |
| Tab switch | <200ms |
| Bundle size (JS+CSS) | <100 KB |
| Aggregated data (critical) | <60 KB |

### Implementation (To Be Detailed)

**Phase 3 deferred until Phase 1+2 complete.**

Will include:
- Detailed component specs
- Chart configurations
- Mobile breakpoints
- Service Worker strategy
- Testing checklist

---

## Merge Strategy (When v2 Ready)

### Pre-Merge Checklist

- [ ] Phase 1 complete: All data compressed on v2
- [ ] Phase 2 complete: Aggregation generates valid outputs
- [ ] Phase 3 complete: Frontend loads aggregated data (<3s)
- [ ] v2 synced with main (no merge conflicts)
- [ ] v2 scripts tested locally (dry run)
- [ ] Backup plan documented (rollback procedure)

### Merge Process

**Step 1: Update Oracle VM collection scripts** (critical path)

```bash
# SSH to Oracle VM
ssh ubuntu@129.151.245.132

# Backup current scripts
cp ~/collect-snapshots.sh ~/collect-snapshots.sh.backup
cp ~/collect-battlelogs.sh ~/collect-battlelogs.sh.backup

# Update to use v2 scripts (with compression)
# Edit cron scripts to call _v2.py variants

# Test manually (dry run, don't commit)
cd ~/brawl-stats
python src/collection/collect_snapshots_v2.py
python src/collection/collect_battlelogs_v2.py

# Verify .json.gz files created correctly
ls -lh data/raw/snapshots/*.json.gz | tail -5
```

**Step 2: Add GitHub Actions aggregation workflow**

Create `.github/workflows/aggregate-data.yml`:
```yaml
name: Aggregate Data

on:
  push:
    branches: [main]
    paths:
      - 'data/raw/**'

jobs:
  aggregate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.12'

      - name: Install uv
        run: pip install uv

      - name: Run aggregation
        run: uv run python src/aggregation/aggregate.py

      - name: Commit aggregated data
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add data/aggregated/
          git diff --quiet && git diff --staged --quiet || \
            git commit -m "Update aggregated stats: $(date +'%Y-%m-%d')"
          git push
```

**Step 3: Merge v2 → main**

```bash
# Final sync before merge
git checkout v2
git pull origin main
# Resolve any conflicts (accept new data files)

# Merge to main
git checkout main
git merge v2
git push origin main
```

**Step 4: Monitor for 1 week**

- [ ] Verify snapshots saved as `.json.gz` (check git commits)
- [ ] Verify aggregation runs on push (check GitHub Actions)
- [ ] Verify frontend loads fast (<3s)
- [ ] Verify no collection failures (check VM logs)

### Rollback Plan

**If collection breaks:**
```bash
# SSH to Oracle VM
ssh ubuntu@129.151.245.132

# Restore backup scripts
cp ~/collect-snapshots.sh.backup ~/collect-snapshots.sh
cp ~/collect-battlelogs.sh.backup ~/collect-battlelogs.sh

# Restart cron jobs
sudo systemctl restart cron

# Verify next collection uses old scripts
tail -f ~/collect-snapshots.log
```

**If aggregation breaks:**
- GitHub Actions failure = non-critical (collection still works)
- Fix aggregation script, re-run manually
- Frontend falls back to loading raw data (slow but functional)

**If frontend breaks:**
- Revert merge: `git revert HEAD`
- Restore old frontend files from git history
- Data collection unaffected (decoupled)

---

## Timeline

### Conservative Estimate (12 weeks)

**Weeks 1-2: Compression**
- Implement v2 collection scripts
- Write compression utilities
- Migrate 164 files on v2 branch
- Test locally (no VM deployment)

**Weeks 3-4: Aggregation**
- Write player stats generation
- Write club stats generation
- Test outputs (~5 MB total)
- Sync with main weekly

**Weeks 5-8: Frontend Core**
- Build data loader (aggregated only)
- Implement router (hash-based)
- Create responsive layout (mobile-first)
- Build Overview + Player Stats tabs

**Weeks 9-10: Frontend Completion**
- Build Timelines + Achievements tabs
- Implement Battles tab (pagination + filters)
- Add Service Worker (offline mode)
- Performance testing

**Weeks 11-12: Merge Preparation**
- Final sync with main
- Test v2 scripts on VM (dry run)
- Update cron jobs on VM
- Merge v2 → main
- Monitor for 1 week

### Aggressive Estimate (6-8 weeks)

If full-time focus, could compress timeline:
- Weeks 1-2: Compression + Aggregation
- Weeks 3-5: Frontend
- Week 6: Testing + Merge

---

## Success Metrics

**Performance:**
- ✅ Initial load <3s (down from 20s)
- ✅ Repeat visits <500ms (with Service Worker)
- ✅ Mobile-friendly (44px tap targets, no horizontal scroll)
- ✅ Repo size <25 MB (down from 145 MB)

**Functionality:**
- ✅ All v1 features working (overview, stats, timelines, achievements, battles)
- ✅ New features: offline mode, teammate chemistry, mode trends
- ✅ Data collection never fails (zero missed days)

**Maintainability:**
- ✅ Clean architecture (raw → aggregated → frontend)
- ✅ Easy to add new stats (update aggregation script)
- ✅ Fast iteration (no framework build step)

---

## Risk Analysis

**Risk: v2 branch diverges too far from main**
- Mitigation: Sync weekly (pull + compress + reaggregate)
- Benefit: Merge conflicts only on data files (auto-resolvable)

**Risk: Collection breaks during merge**
- Mitigation: Test v2 scripts locally first
- Mitigation: Keep backup scripts on VM (5-minute rollback)
- Impact: Low (can rollback within minutes)

**Risk: Aggregation script fails on main**
- Mitigation: GitHub Actions optional (not critical path)
- Impact: Low (collection still works, can fix aggregation later)

**Risk: Frontend breaks on merge**
- Mitigation: Test on v2 branch extensively before merge
- Impact: Medium (users see broken UI, but data collection safe)
- Rollback: Revert merge, restore old frontend

**Risk: Compression corrupts data**
- Mitigation: Integrity tests (SHA256 match after decompress)
- Mitigation: Keep raw data for 1 month (rollback window)
- Impact: Very Low (tested on 5 samples, all passed)

---

## Open Questions

1. **Phase 1 priority:** Compress both snapshots and battlelogs, or snapshots only?
   - **Recommendation:** Both (consistent approach, full benefits)

2. **Aggregation frequency:** Real-time during collection, or post-push on GitHub?
   - **Recommendation:** Post-push (simpler, leverages existing workflow)

3. **Frontend framework:** Truly vanilla, or use build tool (Vite)?
   - **Recommendation:** Vanilla (can add Vite later if needed)

4. **Service Worker strategy:** Aggressive caching, or network-first?
   - **Recommendation:** Cache-first for assets, network-first for data

5. **Deployment timing:** Big-bang merge, or gradual rollout?
   - **Recommendation:** Big-bang (avoid half-broken states on main)

---

## Notes

**What could go wrong:**

1. **Aggregation script runs out of memory** (GitHub Actions has 7 GB limit)
   - Unlikely: Processing 145 MB compressed data = ~2 GB peak memory
   - Mitigation: If happens, can move aggregation to VM

2. **GitHub Actions quota exceeded** (free tier = 2000 min/month)
   - Current usage: ~2 min/day for aggregation = 60 min/month
   - Safe: Well within limits

3. **Brawl Stars API changes format** (adds/removes fields)
   - Mitigation: Raw data storage future-proofs this
   - Aggregation script may need updates, but data preserved

4. **Mobile performance worse than expected**
   - Mitigation: Progressive enhancement (disable charts on slow devices)
   - Testing: Use real Android/iOS devices, not just emulators

**Dependencies on external systems:**
- Brawl Stars API (could change, add fields) → mitigated by raw storage
- GitHub Actions (could change pricing) → can move to VM if needed
- Oracle Cloud VM (could terminate free tier) → scripts portable

---

**Last Updated:** 2026-08-25
**Status:** Phase 1 ready to start
