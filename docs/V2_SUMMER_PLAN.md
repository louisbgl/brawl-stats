# V2 Summer Rebuild Plan

**Branch:** `v2`
**Timeline:** Summer 2026
**Goal:** Fix load times (20s → <3s), improve mobile UX, clean architecture

---

## Current State (Post-Cleanup)

**What We Have:**
- 112 days of snapshot data (94 MB raw)
- 11 players' battlelog data (45 MB raw)
- 3,150 achievements tracked
- Clean file structure:
  - `data/raw/` (snapshots, battlelogs, metadata)
  - `data/aggregated/` (empty, ready)
  - `src/collection/` (working collection code)
  - `src/aggregation/` (achievements.py only)
  - `src/frontend/` (placeholder WIP page)

**What's Nuked:**
- Old frontend (6,351 lines JS, complete removal)
- All CSS/HTML from v1

**What Works:**
- Daily snapshot collection (VM cron, 23:00 UTC)
- Battlelog collection (VM cron, every 30 min)
- Achievement detection (GitHub Actions, post-push)
- Proxy for local dev (bypasses IP whitelist)

---

## Phase 1: Data Compression Strategy

**Problem:** 140 MB raw data grows daily, no compression

**Solution:** Compress at collection time (not post-hoc)

### 1.1 Snapshot Compression

**Rule:** Always save snapshots compressed

**Implementation:**
```python
# src/collection/collect_snapshots.py
def save_snapshot_compressed(data, date):
    """Save snapshot directly as gzipped JSON."""
    filepath = f"data/raw/snapshots/{date}.json.gz"
    with gzip.open(filepath, 'wt', compresslevel=9) as f:
        json.dump(data, f, separators=(',', ':'))

# At end of collection:
save_snapshot_compressed(snapshot_data, today)
```

**What stays uncompressed:**
- `data/raw/metadata/latest.json` (quick access, debugging)
- `data/raw/metadata/brawlers.json` (small, frequently accessed)

**Expected Result:**
- All snapshots: `.json.gz` (~92% compression, 1 MB → 80 KB)
- Git commits: 80 KB per day (not 1 MB)
- Repo size: 10 MB compressed vs 94 MB raw (for 112 days)

**Why compress at collection:**
- Simpler (one place handles compression)
- Smaller git pushes (faster, less bandwidth)
- Aggregation script decompresses on-the-fly (no temp files needed)

**Inspection when needed:**
```python
# testing/inspect_snapshot.py
import gzip, json, sys
with gzip.open(sys.argv[1], 'rt') as f:
    print(json.dumps(json.load(f), indent=2))

# Usage: python testing/inspect_snapshot.py data/raw/snapshots/2026-07-03.json.gz
```

**Auto-compression via GitHub Actions:**

Instead of one-time migration script, use self-healing CI/CD:

```python
# src/aggregation/compress_raw.py
"""Compress any uncompressed files in data/raw/"""
import gzip, json, os
from pathlib import Path

def compress_file(filepath):
    """Compress JSON file to .json.gz, delete original."""
    gz_path = filepath + '.gz'
    if gz_path.exists():
        return  # Already compressed

    with open(filepath, 'r') as f_in:
        data = json.load(f_in)

    with gzip.open(gz_path, 'wt', compresslevel=9) as f_out:
        json.dump(data, f_out, separators=(',', ':'))

    os.remove(filepath)
    print(f"Compressed: {filepath.name}")

def main():
    for file in Path('data/raw/snapshots').glob('*.json'):
        if file.name != '_last_updated.json':
            compress_file(file)

    for file in Path('data/raw/battlelogs').glob('*.json'):
        if file.name != '_last_updated.json':
            compress_file(file)
```

```yaml
# .github/workflows/compress-raw.yml
name: Compress Raw Data

on:
  push:
    branches: [main]
    paths:
      - 'data/raw/**/*.json'

jobs:
  compress:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Compress uncompressed files
        run: python src/aggregation/compress_raw.py

      - name: Commit compressed files
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add data/raw/
          git diff --quiet && git diff --staged --quiet || \
            git commit -m "Auto-compress raw data files"
          git push
```

**Benefits:**
- Self-healing (any uncompressed JSON gets compressed automatically)
- Works on merge (dev → main with raw files = auto-compress)
- Works on accidents (if collection script saves raw, CI fixes it)
- Idempotent (already compressed = skip)

**Testing:**
- ✅ Already tested compression integrity (SHA256 match, 5/5 samples)
- Need: Modify collection script to save compressed (primary path)
- Need: Write compress_raw.py + GitHub Actions workflow (fallback)
- Need: Test aggregation script reads compressed correctly

### 1.2 Battlelog Compression

**Decision:** Compress at collection time (same strategy)

**Implementation:**
```python
# src/collection/collect_battlelogs.py
def save_battlelog_compressed(tag, battles):
    """Save battlelog directly as gzipped JSON."""
    filepath = f"data/raw/battlelogs/{tag}.json.gz"
    with gzip.open(filepath, 'wt', compresslevel=9) as f:
        json.dump(battles, f, separators=(',', ':'))
```

**Expected Result:**
- Battlelogs: 45 MB → ~8 MB compressed
- Total raw data: 94 MB snapshots + 45 MB battlelogs = **139 MB → ~18 MB** (87% savings)

**Aggregation reads compressed:**
```python
def load_battlelogs():
    battlelogs = {}
    for file in glob('data/raw/battlelogs/*.json.gz'):
        tag = extract_tag_from_filename(file)
        with gzip.open(file, 'rt') as f:
            battlelogs[tag] = json.load(f)
    return battlelogs
```

---

## Phase 2: Aggregation Pipeline

**Problem:** Frontend fetches 140 MB raw JSON on every page load

**Solution:** Pre-aggregate stats during collection, frontend fetches only needed data

### 2.1 Aggregation Architecture

**Trigger:** GitHub Actions after data push to main

**Flow:**
```
data/raw/ (snapshots + battlelogs)
    ↓
src/aggregation/aggregate.py (main entry point)
    ↓
data/aggregated/ (precomputed stats)
```

**Output Structure:**
```
data/aggregated/
  club-summary.json          (~50 KB)
    - Trophy timeline (all players, daily)
    - Mode popularity (total games by mode)
    - Leaderboards (trophies, prestige, win rate)

  players/
    {TAG}/
      timeline.json           (~5 KB per player)
        - Daily: trophies, prestige, 3vs3Victories

      brawlers.json           (~20 KB per player)
        - Current brawler levels, items owned
        - Missing items for upgrade calculations

      battle-stats.json       (~10 KB per player)
        - Overall: games, wins, losses, win rate
        - By mode: win rates for each game mode
        - By brawler: win rates per brawler
        - Teammate chemistry: win rates with each club member

      recent-battles.json     (~30 KB, last 50 battles)
        - For battle feed view

  indexes/
    dates.json                (~1 KB)
      - Available date range, monthly markers

    players.json              (~1 KB)
      - Tag → name mapping for all tracked players

  achievements.json           (move from data/achievements.json)
    - Already generated, just relocate
```

### 2.2 Aggregation Modules

**`src/aggregation/aggregate.py`** (main orchestrator)
```python
def main():
    # Load all raw data
    snapshots = load_snapshots()
    battlelogs = load_battlelogs()

    # Generate aggregations
    generate_club_summary(snapshots, battlelogs)
    for tag in all_tracked_players():
        generate_player_timeline(tag, snapshots)
        generate_player_brawlers(tag, snapshots[-1])  # latest only
        generate_player_battle_stats(tag, battlelogs[tag])
        generate_recent_battles(tag, battlelogs[tag])

    generate_indexes(snapshots)

    # Optional: Compress old raw data
    compress_old_snapshots()
```

**`src/aggregation/club_stats.py`**
- Extract trophy timeline from snapshots
- Aggregate mode popularity from battlelogs
- Calculate leaderboards (sort players by various metrics)

**`src/aggregation/player_stats.py`**
- Extract daily progression (trophies, prestige, wins)
- Calculate win rates by mode/brawler
- Compute teammate chemistry (shared battles → win rates)

**`src/aggregation/achievements.py`** (already exists)
- Keep as-is, just ensure output goes to `data/aggregated/`

**`src/aggregation/compression.py`**
- Extract compression logic from collection scripts
- Shared utility for both snapshots and battlelogs

### 2.3 GitHub Actions Integration

**`.github/workflows/aggregate-data.yml`**
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

### 2.4 Expected Performance Impact

**Before (v1):**
- Initial load: 140 MB raw JSON (112 snapshots + 11 battlelogs)
- Time: 20 seconds on 4G
- Every page reload: full 140 MB fetch
- Repo size: 140 MB + growing 1 MB/day

**After (v2 with compression + aggregation):**
- Initial load: ~500 KB (club-summary + indexes + latest player data)
- Time: **2-3 seconds** (7x faster)
- Subsequent tabs: ~50 KB each (on-demand player data)
- Repeat visits with Service Worker: **<500ms** (instant from cache)
- Repo size: 18 MB compressed raw + ~5 MB aggregated = **23 MB total** (83% savings)
- Daily growth: 80 KB/day (compressed) instead of 1 MB/day

---

## Phase 3: Frontend Rebuild

**Philosophy:** Start from scratch, no legacy constraints

### 3.1 Technology Choices

**Keep Simple:**
- Vanilla JavaScript (ES6 modules, no framework bloat)
- Modern CSS (Grid, Flexbox, CSS variables)
- Chart.js for visualizations (proven, works)

**Why No Framework:**
- Personal project (overkill to add React/Vue build step)
- Fast iteration (no compile, just refresh)
- Small bundle (no framework = faster load)

### 3.2 File Structure

```
src/frontend/
  index.html              (main page)

  css/
    main.css              (core styles, CSS variables)
    mobile.css            (responsive overrides)

  js/
    core/
      data-loader.js      (fetch aggregated data only)
      router.js           (hash-based navigation)
      constants.js        (game constants, mode names, colors)

    views/
      overview.js         (club summary + leaderboards)
      player-stats.js     (per-player deep dive)
      timelines.js        (historical charts)
      achievements.js     (milestone feed)
      battles.js          (battle log viewer)

    utils/
      chart-builder.js    (Chart.js wrappers)
      formatters.js       (dates, numbers, time ago)

  assets/                 (symlink to ../../assets/)
```

### 3.3 Core Principles

**Data Loading:**
- Load ONLY aggregated data (never touch `data/raw/`)
- 3-phase loading:
  1. Critical (club-summary, indexes) - blocking
  2. Background (player data for selected player) - lazy
  3. On-demand (historical, battles) - user-triggered

**Mobile-First:**
- Touch-friendly (44px tap targets minimum)
- Responsive breakpoints (320px, 768px, 1024px)
- Fast on slow connections (lazy load images, defer non-critical)

**Performance:**
- Service Worker for offline caching (repeat visits instant)
- Debounce filters (wait 300ms before re-rendering charts)
- Virtual scrolling for long lists (achievements, battles)

### 3.4 Views Specification

**Overview Tab:**
- Club trophy timeline (Chart.js line, all players)
- Leaderboards (trophies, prestige, win rate, activity)
- Quick stats (total games, avg trophies, mode breakdown)

**Player Stats Tab:**
- Player selector dropdown
- Trophy progression chart (with date range filter)
- Brawler breakdown table (searchable, sortable)
  - Columns: Name, Power, Trophies, Prestige, Missing Items
  - Show owned + unowned brawlers
- Account Worth card (total coins/power points needed for max)
- Battle performance (win rate, MVP %, recent form)
- Brawler battle stats (top brawlers by games/wins/MVP)
- Teammate chemistry (win rate with each club member)

**Timelines Tab:**
- Historical charts (9+ months data)
- Trophy progression (all players)
- Win count progression
- Prestige milestones over time
- Activity trends (games per day)
- Mode popularity evolution

**Achievements Tab:**
- Chronological feed (newest first)
- Filters: player, achievement type
- Icons for each type (new brawler, prestige, maxed, items)
- Relative dates ("2 weeks ago")

**Battles Tab:**
- Paginated feed (50 battles per page)
- Filters: player, mode, result (W/L)
- Expandable rows (show all participants + stats)
- Battle type indicators (ranked, soloRanked, friendly)

### 3.5 Design System

**Color Palette:**
- Primary: `#667eea` (purple, Brawl Stars theme)
- Secondary: `#f56565` (red, for losses)
- Success: `#48bb78` (green, for wins)
- Background: `#1a202c` (dark mode default)
- Surface: `#2d3748`
- Text: `#e2e8f0` (light on dark)

**Typography:**
- Headings: System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', ...`)
- Monospace: `'SF Mono', 'Monaco', 'Courier New'` (for stats)

**Icons:**
- Use existing `assets/icons/` (gadget, hypercharge, starpower)
- Emoji for achievements (🎉 new brawler, ⭐ prestige, 💎 maxed)

### 3.6 Mobile UX Improvements (vs v1)

**v1 Problems:**
- Tiny tap targets (buttons <30px)
- Horizontal scroll on tables
- Charts overflow on small screens
- No touch gestures (swipe to change tabs)

**v2 Solutions:**
- 44px minimum tap targets (Apple HIG standard)
- Responsive tables (stack on mobile, horizontal scroll contained)
- Charts use responsive: true, maintainAspectRatio: false
- Swipe gestures for tab navigation (touch-friendly)
- Bottom nav bar on mobile (thumbs reach easily)

---

## Phase 4: Service Worker (Offline Mode)

**Goal:** Instant repeat visits, works offline

### 4.1 Caching Strategy

**Cache on first visit:**
- `data/aggregated/club-summary.json`
- `data/aggregated/indexes/*.json`
- All CSS/JS assets
- Brawler icons

**Cache on demand:**
- Player data (when selected)
- Historical timelines (when tab opened)

**Update strategy:**
- Check for new data every 60 seconds
- Show "New data available" banner
- User clicks → fetch updates, refresh UI

### 4.2 Implementation

**`src/frontend/sw.js`** (Service Worker)
```javascript
const CACHE_VERSION = 'v2-2026-07-03'
const CACHE_ASSETS = [
  '/',
  '/css/main.css',
  '/css/mobile.css',
  '/js/core/data-loader.js',
  // ... etc
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(CACHE_ASSETS))
  )
})

self.addEventListener('fetch', e => {
  // Network-first for data, cache-first for assets
})
```

**Expected Impact:**
- First visit: 2-3s load
- Repeat visits: **<500ms** (cache hit)
- Offline: Full functionality (with cached data)

---

## Implementation Order (Recommended)

### Week 1-2: Compression + Basic Aggregation
1. Write `src/aggregation/compress_raw.py` (auto-compress uncompressed files)
2. Create `.github/workflows/compress-raw.yml` (CI/CD workflow)
3. Modify `collect_snapshots.py` to save compressed (`.json.gz`)
4. Modify `collect_battlelogs.py` to save compressed
5. Test locally: collection scripts produce valid `.json.gz` files
6. Deploy compression workflow: push to main, verify existing 112 files compress
7. Write `src/aggregation/aggregate.py` skeleton (reads compressed data)
8. Implement `club_stats.py` (club-summary.json generation)
9. Test locally: run aggregation on compressed data, verify output

### Week 3-4: Player Aggregation + GitHub Actions
6. Implement `player_stats.py` (timelines, brawlers, battle-stats)
7. Relocate achievements to `data/aggregated/`
8. Create GitHub Actions workflow (aggregate on push)
9. Test on VM: trigger collection, verify aggregation runs
10. Monitor for 1 week (ensure no failures)

### Week 5-6: Frontend Core
11. Build `data-loader.js` (fetch aggregated data only)
12. Implement router (hash-based navigation)
13. Create responsive layout (mobile-first)
14. Build Overview tab (club summary + leaderboards)
15. Test on mobile (real device, not just responsive mode)

### Week 7-8: Player Stats + Battles
16. Build Player Stats tab (charts + tables)
17. Implement Battles tab (pagination + filters)
18. Add search/sort/filter to brawler table
19. Test performance (ensure <3s load on 4G)

### Week 9-10: Timelines + Achievements
20. Build Timelines tab (historical charts)
21. Implement Achievements tab (feed + filters)
22. Add date range filters to charts
23. Test with full 9-month dataset

### Week 11-12: Polish + Service Worker
24. Implement Service Worker (offline mode)
25. Add mobile swipe gestures
26. Performance optimization (debounce, lazy load)
27. Final testing (desktop, mobile, offline)
28. Deploy to production (merge v2 → main)

---

## Success Metrics

**Performance:**
- ✅ Initial load <3s (down from 20s)
- ✅ Repeat visits <500ms (with Service Worker)
- ✅ Mobile-friendly (44px tap targets, no horizontal scroll)

**Functionality:**
- ✅ All v1 features working (overview, stats, timelines, achievements, battles)
- ✅ New features: offline mode, teammate chemistry, mode trends
- ✅ Better mobile UX (swipe nav, bottom bar, responsive charts)

**Maintainability:**
- ✅ Clean architecture (raw → aggregated → frontend)
- ✅ Easy to add new stats (just update aggregation script)
- ✅ Fast iteration (no framework build step)

---

## Future Enhancements (Post-Summer)

**If time permits or for later:**
- Streak tracking (current win/loss streak per brawler)
- Map performance (win rate per map name)
- Head-to-head analysis (win rate vs specific opponents)
- Brawler matchup matrix (brawler A vs brawler B)
- Trend analysis (win rate improving/declining over time)
- Push notifications (achievement unlocked, new data available)
- Dark/light mode toggle (currently dark only)
- Export stats to CSV/JSON (for external analysis)

**Nice to Have:**
- Native mobile app (React Native or Flutter)
- Real-time updates (WebSocket, if API supports)
- Custom date ranges (arbitrary start/end, not just presets)
- Advanced filters (combine player + mode + date range)

---

## Notes & Considerations

**What Could Go Wrong:**

1. **Aggregation script fails:**
   - Mitigation: Keep v1 data format for 1 month (fallback)
   - Testing: Run aggregation locally before deploying

2. **GitHub Actions quota exceeded:**
   - Current: Free tier = 2000 min/month
   - Usage: ~2 min/day (aggregation) = 60 min/month
   - Safe: Well within limits

3. **Data migration issues:**
   - Mitigation: All raw data preserved in `data/raw/`
   - Can regenerate aggregations anytime

4. **Mobile performance worse than expected:**
   - Mitigation: Progressive enhancement (disable charts on slow devices)
   - Testing: Test on real Android/iOS devices, not just simulators

**Dependencies on External Systems:**

- Brawl Stars API (could change format, add fields)
  - Mitigation: Raw data storage future-proofs this
- GitHub Actions (could change pricing, limits)
  - Mitigation: Can move aggregation to VM if needed
- Oracle Cloud VM (could terminate free tier)
  - Mitigation: Collection scripts portable, can run elsewhere

**Time Estimates:**

- Conservative: 12 weeks (following schedule above)
- Realistic: 8-10 weeks (some tasks faster than expected)
- Aggressive: 6 weeks (if full-time focus)

---

## Questions to Answer Before Starting

1. **Compression priority:** Start with snapshots only, or implement battlelogs too?
   - **Recommendation:** Snapshots only for now (battlelogs deferred)

2. **Aggregation frequency:** Real-time during collection, or post-push on GitHub?
   - **Recommendation:** Post-push (simpler, leverages existing workflow)

3. **Frontend framework:** Truly vanilla, or use build tool (Vite)?
   - **Recommendation:** Vanilla for simplicity (can add Vite later if needed)

4. **Mobile testing:** Emulator only, or get real devices?
   - **Recommendation:** Real devices (borrow/test on personal phone)

5. **Deployment strategy:** Big-bang merge, or gradual rollout?
   - **Recommendation:** Test on v2 branch, merge when complete (avoid half-broken states)

---

## Getting Started Checklist

Before coding:
- [ ] Review this plan with fresh eyes
- [ ] Decide on compression strategy (snapshots only? battlelogs too?)
- [ ] Sketch frontend wireframes (mobile + desktop)
- [ ] Set up local testing workflow (run aggregation locally)
- [ ] Create GitHub Projects board (track progress visually)

Week 1 tasks:
- [ ] Implement snapshot compression
- [ ] Test compression integrity (run on all 112 files)
- [ ] Write `aggregate.py` skeleton
- [ ] Generate first `club-summary.json`
- [ ] Verify JSON output format (pretty-print, inspect)

---

**Last Updated:** 2026-07-03
**Status:** Planning phase complete, ready to execute
