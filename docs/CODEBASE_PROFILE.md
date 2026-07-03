# Brawl Stars Club Tracker: Codebase Profile

**Last Updated:** 2026-07-03
**Purpose:** Architectural assessment for summer 2026 improvement planning

---

## 1. WHAT THIS SYSTEM DOES FOR THE USER

**Core Value Proposition:**
Automatic, continuous tracking of Brawl Stars player progression with zero manual input. Users get:

1. **Historical trend analysis** (9+ months) - Trophy progression, win counts, collection growth, prestige milestones
2. **Real-time battle tracking** (30-minute collection intervals) - Win/loss records, mode preferences, MVP stats, teammate chemistry
3. **Achievement timeline** - Automatic detection of 9 milestone types (new brawlers, prestige levels, maxed brawlers, trophy thresholds)
4. **Club-wide leaderboards** - Compare performance across all tracked players
5. **Per-player deep dives** - Brawler-level stats, power/prestige distribution, activity heatmaps, upgrade cost calculations

**Key Differentiator:**
Brawl Stars API only exposes current state. This system captures snapshots daily, building irreplaceable historical data that the API cannot backfill.

---

## 2. SYSTEM ARCHITECTURE

### 2.1 Data Collection Layer (Python Backend)

**Components:**
- **Daily snapshots** (23:00 UTC): Player profiles, trophies, brawler levels, items owned
- **Battlelog collection** (every 30 min): Recent battle results (last ~25 games per player)
- **Achievement generation** (post-push): Differential analysis of consecutive snapshots

**Execution Environment:**
- Oracle Cloud VM (129.151.245.132) runs cron jobs
- Python 3.12 managed by `uv` package manager
- Flask proxy provides static IP for API authentication

**Data Flow:**
```
Brawl Stars API → Python scripts → JSON files → Git branches → Main branch → GitHub Actions
```

**Critical Design Decision (April 2026 Incident Response):**
- **DATA FIRST, GIT SECOND** principle: Collection NEVER fails due to git state
- Zero file overlap between `data-snapshots` and `data-battlelogs` branches → merge conflicts physically impossible
- 10-second git lock timeout prevents blocking data collection
- Backup system: Data saved to `/home/ubuntu/brawl-stats-backup/` if git unavailable

### 2.2 Storage Layer

**Format Philosophy:** Raw API responses + metadata only

- **Snapshots:** `data/snapshots/YYYY-MM-DD.json` (1 MB each, 94 MB total for 9 months)
- **Battlelogs:** `data/battlelogs/{TAG}.json` (1-10 MB each, 45 MB total for 5 players)
- **Metadata:** `latest.json` (1.2 MB cache), `brawlers.json` (124 KB game reference), `achievements.json` (620 KB, 1000+ milestones)

**Why raw storage?**
- Future-proof: API schema changes don't require data migration
- Compatibility layer (JavaScript Proxy) maps snake_case (old) ↔ camelCase (new) transparently
- Zero risk of information loss due to filtering

**Battle Type Complexity:**
- 15 game modes (gemGrab, brawlBall, duels, lastStand, soloShowdown, etc.)
- 4 battle types (ranked, soloRanked, friendly, null)
- Special handling: Duels has per-brawler trophy changes, showdown has rank placement, PvE has no trophies

### 2.3 Visualization Layer (JavaScript Frontend)

**Architecture:** Vanilla JS with Chart.js, module-based, lazy loading strategy

**3-Phase Loading:**
1. **Critical phase** (blocking, ~150ms): Load `latest.json` + `brawlers.json`, render skeleton
2. **Background phase** (non-blocking, ~3-5s): Load historical snapshots (94 MB) + battlelogs (45 MB) via `requestIdleCallback`
3. **On-demand phase** (lazy): Load player detail views, achievements, battles on tab click

**Module Organization:**
- **Core modules** (load order critical):
  1. `config.js` - Game constants, utilities
  2. `helpers.js` - Shared helpers (battle analysis, chart factories, calculations)
  3. `data.js` - DataManager (single source of truth for all data)
  4. `app.js` - Initialization orchestration

- **Feature modules** (background load):
  - `charts.js` - Club-wide timeline charts
  - `player-charts.js` - Per-player analytics
  - `player-stats.js` - Detailed player view (1,172 lines, largest module)
  - `achievements.js` - Milestone feed
  - `battles.js` - Paginated battle log viewer
  - `router.js` - Hash-based URL routing
  - `auto-refresh.js` - Live timestamp updates

**Key Design Patterns:**
- **No code duplication:** All chart configs, battle lookups, calculations use shared helpers
- **Single source of truth:** Game constants in `GameConstants`, colors in `COLOR_PALETTE`
- **Stateless helpers:** Pure functions for predictability
- **Compatibility layer:** Proxy wraps old data to support snake_case field names

---

## 3. INNER WORKINGS: HOW IT WORKS

### 3.1 Data Collection Pipeline

**Daily Snapshot Workflow** (`collect-snapshots.sh` → `collect_data.py`):
```
1. Try acquire git lock (10s timeout)
2. If locked → checkout data-snapshots branch, pull latest
3. Run collect_data.py (ALWAYS RUNS regardless of git state):
   a. Fetch brawlers reference → brawlers.json
   b. For each club: fetch club data → fetch each member profile
   c. For each individual player: fetch profile
   d. Create snapshot with timestamp
   e. Save to data/snapshots/YYYY-MM-DD.json + data/latest.json
4. If locked → commit snapshot files ONLY, push to data-snapshots branch
5. If locked → merge to main with auto-conflict resolution (keep snapshots, preserve battlelogs)
6. If NO lock → data saved to /home/ubuntu/brawl-stats-backup/ for manual recovery
```

**Battlelog Collection Workflow** (`collect-battlelogs.sh` → `collect_battlelogs.py`):
```
1. Try acquire git lock (10s timeout)
2. If locked → checkout data-battlelogs branch, pull latest
3. Run collect_battlelogs.py (ALWAYS RUNS):
   a. Get all tracked player tags
   b. For each player: fetch battlelog API, merge with existing battles, dedupe by battleTime
   c. Save to data/battlelogs/{TAG}.json
4. If locked → commit battlelog files ONLY, push to data-battlelogs branch
5. If locked → merge to main (keep battlelogs, preserve snapshots)
6. If NO lock → data saved to backup directory
```

**Achievement Generation** (GitHub Actions post-push):
```
1. Trigger: Push to main (after snapshot/battlelog merge)
2. Load all historical snapshots
3. Compare consecutive days, detect 9 milestone types:
   - New brawler unlocked
   - Maxed brawler (P11 + 2 gadgets + 2 star powers + hypercharge)
   - Gadget/Star Power/Hypercharge unlocked
   - Prestige milestone per brawler (every 1000 trophies)
   - Trophy milestone per player (every 10,000 trophies)
   - First brawler to reach prestige 2-7
   - Total prestige threshold (every 10 across account)
4. Dedupe by key: player_tag|type|brawler|item_id|prestige_level|milestone_value
5. Append new achievements to achievements.json
6. Commit back to main
```

### 3.2 Frontend Data Flow

**Initial Load** (`app.js::init()`):
```
Phase 1: await DataManager.init()
  → Load latest.json (1.2 MB, current snapshot)
  → Load brawlers.json (124 KB, game reference)
  → Build player name cache
  → Render UI skeleton, populate player selector

Phase 2: requestIdleCallback(() => DataManager.initBackground())
  → Load all historical snapshots (data/snapshots/*.json)
  → Load all battlelogs (data/battlelogs/*.json)
  → Load achievements.json
  → Trigger "data ready" events

Phase 3: Router.init()
  → Setup hash-based navigation
  → Route to initial view (#/overview or #/player/{TAG})

Phase 4: AutoRefreshManager.init()
  → Start "X minutes ago" timestamp updates
  → Poll latest.json every 60s for new data
```

**Chart Rendering Example** (trophy timeline):
```
1. User clicks "Timelines" tab
2. ChartsManager.createTrophyTimeline() called
3. Ensure historical data loaded: await DataManager.ensureHistoricalLoaded()
4. Extract trophy values from each snapshot for each player
5. Use ChartHelpers.createLineDataset() to create Chart.js datasets
6. Apply GameConstants.COLOR_PALETTE for consistent colors
7. Render Chart.js line chart with shared options
```

**Battle Analysis Example** (win rate calculation):
```
1. User selects player in "Player Stats" tab
2. PlayerStatsManager.showPlayerStats(playerTag) called
3. Ensure battlelog loaded: await DataManager.ensureBattlelogsLoaded()
4. Get battles: DataManager.getBattlesForPlayer(playerTag)
5. Use BattlelogHelpers.calculateBrawlerStats(playerTag, battles):
   a. For each battle:
      - getTrophyChange(battle, playerTag) → handles duels summing
      - isWin(battle, playerTag) → checks trophy_change > 0 or battle.result
      - getPlayerBrawlerFromBattle(battle, playerTag) → single brawler or array (duels)
   b. Aggregate: games, wins, losses, trophyChange, MVPs per brawler
6. Render table with sortable columns
```

### 3.3 Battle Type Handling (Critical Complexity)

**Why this matters:** Brawl Stars has 15 game modes with different data structures

**Mode Categories:**
- **Team 3v3** (gemGrab, brawlBall, bounty, etc.): `battle.teams[]` with 3 players each, battle-level `trophyChange`
- **Team 5v5** (brawlBall5V5, wipeout5V5, etc.): `battle.teams[]` with 5 players each
- **Showdown** (soloShowdown, duoShowdown, trioShowdown): `battle.players[]` with `rank` placement, no trophyChange
- **Duels**: `battle.players[]` where each player uses 3 brawlers, each with individual `trophyChange`
- **PvE** (lastStand): `battle.teams[]` but no trophyChange (cooperative)

**Handling Strategy:**
- `src/battle_models.py`: Helper methods `is_team_mode()`, `is_showdown_mode()`, `is_duels_mode()`, `is_pve_mode()`
- `js/helpers.js::BattlelogHelpers.getTrophyChange()`:
  - Standard modes: return `battle.trophyChange`
  - Duels: sum per-brawler `trophyChange` for player
  - Showdown/PvE: return 0 (no trophies)
- `js/helpers.js::BattlelogHelpers.calculateBrawlerStats()`: Handles duels aggregation (one battle = 3 brawlers)

---

## 4. SHORTCOMINGS & LIMITATIONS

### 4.1 Data Collection Fragility

**Critical Constraint:** Brawl Stars data is EPHEMERAL
- API only returns current state (no historical queries)
- If daily snapshot missed → that day's data LOST FOREVER
- Battle logs rotate out after ~7 days → battles not collected in time are LOST FOREVER

**Current Risks:**

1. **Git lock failure recovery incomplete**
   - Problem: If git lock unavailable, data saved to backup directory but not persisted
   - Impact: `git reset --hard` cleans up uncommitted files → data silently lost
   - Workaround: Manual SSH recovery, but requires noticing failure
   - Fix needed: True persistent backup location outside git working directory

2. **No rate-limit handling**
   - `src/api.py` raises generic Exception on API errors
   - No retry logic, no exponential backoff
   - Risk: If API rate-limits, collection silently fails with partial data
   - Impact: Gaps in historical record

3. **No alerting/monitoring**
   - Collection failures logged to VM files (`collect-snapshots.log`, `collect-battlelogs.log`)
   - Manual log checking required to detect outages
   - Risk: Multi-day outages could go unnoticed

4. **Error handling too broad**
   - `except Exception as e: print(f"Error: {e}")` catches everything
   - No distinction between 429 (rate limit), 401 (auth), 500 (server), 404 (not found)
   - Debugging difficult without clear error categorization

### 4.2 Frontend Performance Bottlenecks

1. **Historical snapshot loading: 94 MB**
   - All 9 months loaded sequentially into memory
   - ~3-5 second load time on 4G
   - Improvement: Paginate by month, load visible range first

2. **Chart.js rendering: 10+ charts**
   - All charts created eagerly once data loads
   - No virtualization for off-screen charts
   - Filter changes trigger full re-render
   - Improvement: Debounce filters, lazy-render invisible charts

3. **Battlelog memory usage: 45 MB**
   - All 5 players' battles loaded into `Map<tag, battles[]>`
   - Improvement: Lazy-load by player, paginate by date

4. **No caching layer**
   - All data re-fetches on every page reload
   - Improvement: Service Worker to cache snapshots/battlelogs locally → offline mode + instant repeat loads

### 4.3 Code Duplication

1. **Mode filtering logic** (3+ places)
   - charts.js (mode popularity timeline)
   - battles.js (mode filter dropdown)
   - player-charts.js (game mode pie chart)
   - Fix: Shared `ModeFilter` helper

2. **Time range filtering** (3 places)
   - Trophy timeline (date range buttons)
   - Activity timeline (30/7/all day selector)
   - Achievements (implicit by data availability)
   - Fix: Reusable `TimeRangeFilter` component

3. **Battle type detection inconsistency**
   - `BattlelogHelpers.isWin()` exists but not always used
   - Some code checks `battle.result === 'victory'` directly
   - Fix: Enforce helper usage

### 4.4 Missing Features

**User-Requested:**
1. **Streak tracking:** Current win/loss streak per brawler (multi-day)
2. **Map performance:** Win rate per map name (e.g., "70% on Gem Valley")
3. **Head-to-head:** Win rate against specific opponents (currently only vs teammates)
4. **Trend analysis:** Win rate improvement over time, time-of-day performance
5. **Notifications:** Push alert when achievement unlocked or new data available

**Technical:**
1. **Full-text search:** No search for map names, achievement types, player names
2. **Offline mode:** No Service Worker, requires internet
3. **Mobile app:** No native iOS/Android app (currently responsive web only)
4. **Keyboard shortcuts:** No hotkeys for navigation, filtering

### 4.5 Code Quality Gaps

**Python:**
- No type hints (except dataclasses) → harder to catch errors at dev time
- Global API cache (`_BRAWLERS_CACHE`) → not threadsafe (though scripts are single-threaded)
- Exception handling too broad → catches `KeyboardInterrupt`

**JavaScript:**
- Deeply nested conditionals in `player-stats.js` (line 1000+) → hard to follow
- Magic numbers (e.g., "9" months hardcoded start date, "10" games minimum for ranking)
- Inconsistent naming (mix of get/create/calculate verbs)

**Testing:**
- Zero automated tests (Python or JavaScript)
- Manual verification only → regression risk

---

## 5. ARCHITECTURAL STRENGTHS

### What's Done Really Well

1. **Data safety first mentality**
   - Collection ALWAYS runs regardless of git state
   - Backup system for failed pushes
   - Raw data storage prevents information loss
   - Incident-driven design (April 2026 migrations produced elegant solutions)

2. **Elegant separation of concerns**
   - Python: Data collection + transformation
   - JavaScript: Presentation + interaction
   - No cross-layer dependencies

3. **Future-proofing**
   - Raw API storage → schema changes handled transparently
   - Compatibility proxy → old code works with new data
   - No model lock-in

4. **Performance optimization for common case**
   - 3-phase loading: critical → background → on-demand
   - `requestIdleCallback` prevents main thread blocking
   - Lazy loading of historical data

5. **Comprehensive battle mode handling**
   - All 15 modes supported correctly
   - Duels per-brawler trophy changes handled
   - Showdown placement vs trophyChange distinction clear
   - Code comments explain each mode type

6. **Git automation with safety nets**
   - Branch file ownership prevents conflicts
   - 10-second lock timeout won't block data collection
   - Auto-conflict resolution by file ownership
   - Backup recovery procedure documented

---

## 6. IMPROVEMENT OPPORTUNITY MATRIX

### Priority 1 (High Impact, Low Effort)

| Improvement | Impact | Effort | Details |
|-------------|--------|--------|---------|
| **Add rate-limit backoff** | Critical | 50 lines | Prevents data loss from API throttling |
| **Extract shared mode filtering** | High | 50 lines | Eliminates duplication in 3 modules |
| **Centralize prestige calculation** | Medium | 10 lines | Single source of truth for Python + JS |
| **Add error boundaries** | High | 100 lines | Prevents cascade failures, user-friendly errors |

### Priority 2 (High Impact, Medium Effort)

| Improvement | Impact | Effort | Details |
|-------------|--------|--------|---------|
| **Service Worker caching** | High | 200 lines | Offline mode, instant repeat loads |
| **Alerting system** | Critical | 150 lines | Email/Slack on collection failures |
| **Improve shell script reliability** | Medium | 200 lines | Replace bash with Python, better error handling |
| **Chart virtualization** | Medium | 150 lines | Debounce filters, lazy-render off-screen charts |

### Priority 3 (Medium Impact, High Effort)

| Improvement | Impact | Effort | Details |
|-------------|--------|--------|---------|
| **Map performance analytics** | Medium | 300 lines | Extract map names, aggregate win rate per map |
| **Full-text search** | Medium | 250 lines | Index achievements, battles, player names |
| **Automated testing** | Medium | 500 lines | Unit tests for helpers, integration tests for data flow |
| **Opponent tracking** | Low | 400 lines | Store opponent tags, calculate head-to-head stats |

### Priority 4 (Nice to Have, Very High Effort)

| Improvement | Impact | Effort | Details |
|-------------|--------|--------|---------|
| **Mobile app** | High | 2000+ lines | React Native or Flutter, sync with GitHub Pages data |
| **Real-time updates** | Medium | 500 lines | WebSocket or polling for live battle feed |
| **Brawler matchup analysis** | Low | 600 lines | Track brawler A vs brawler B win rates |

---

## 7. TECHNICAL DEBT SUMMARY

| Category | Severity | Examples |
|----------|----------|----------|
| **Data Safety** | 🔴 Critical | Git lock failure loses data, no rate-limit handling, no alerting |
| **Code Duplication** | 🟡 Moderate | Mode filtering (3 places), time range filtering (3 places) |
| **Performance** | 🟡 Moderate | 94 MB sequential load, no chart virtualization, no caching |
| **Error Handling** | 🟠 High | Generic exceptions, no retry logic, silent partial failures |
| **Testing** | 🟠 High | Zero automated tests, manual verification only |
| **Documentation** | 🟢 Good | CLAUDE.md comprehensive, code comments clear |

---

## 8. METRICS SNAPSHOT (July 2026)

**Data Scale:**
- 94 MB snapshots (9+ months daily collection)
- 45 MB battlelogs (5 players × ~25-100 battles each)
- 620 KB achievements (1000+ milestones)
- **Total: ~143 MB**

**Codebase Size:**
- 6,351 lines JavaScript (13 modules)
- 2,400+ lines Python (6 core modules + 3 collection scripts)
- **Total: ~8,800 lines of code**

**User-Facing Features:**
- 5 main tabs (Overview, Player Stats, Timelines, Achievements, Battles)
- 20+ charts/visualizations
- 9 achievement types tracked
- 15 game modes supported

**Collection Frequency:**
- Daily snapshots (23:00 UTC)
- Battlelog collection (every 30 minutes)
- Achievement generation (on every push to main)

---

## 9. FUTURE-PROOFING NOTES

**What makes this system resilient to change:**

1. **Raw API storage** → When Brawl Stars adds new fields (e.g., new item type, new battle mode), data automatically captures them without code changes

2. **Compatibility layer** → Old code continues working even when API changes from snake_case to camelCase

3. **Incident-driven design** → April 2026 merge conflict incidents led to elegant zero-overlap branch strategy

4. **Separation of concerns** → Python backend changes don't affect JavaScript frontend (and vice versa)

**Potential breaking changes to watch for:**

1. **API authentication changes** → Currently uses Bearer token; if OAuth required, major refactor needed
2. **Rate limit tightening** → Currently no backoff; tighter limits could break collection
3. **Battle log data structure changes** → Duels mode handling is complex; new modes may require similar complexity
4. **GitHub Actions pricing** → Currently free tier; if costs exceed limits, need alternative CI/CD

---

## 10. FILE LOCATION QUICK REFERENCE

### Critical Files for Data Collection
- `/home/louis/projects/brawl/src/config.py` - Player/club configuration
- `/home/louis/projects/brawl/src/api.py` - API client (needs rate-limit handling)
- `/home/louis/projects/brawl/collect_data.py` - Daily snapshot script
- `/home/louis/projects/brawl/collect_battlelogs.py` - 30-min battlelog script
- `/home/louis/projects/brawl/collect-snapshots.sh` - Oracle VM cron (daily)
- `/home/louis/projects/brawl/collect-battlelogs.sh` - Oracle VM cron (30-min)

### Critical Files for Frontend
- `/home/louis/projects/brawl/js/data.js` - DataManager (single source of truth)
- `/home/louis/projects/brawl/js/helpers.js` - BattlelogHelpers, ChartHelpers, CalculationHelpers
- `/home/louis/projects/brawl/js/config.js` - GameConstants (mode names, colors, costs)
- `/home/louis/projects/brawl/js/player-stats.js` - Largest module (1,172 lines)

### Infrastructure
- `/home/louis/projects/brawl/.github/workflows/generate-achievements.yml` - Post-push achievement generation
- `/home/louis/projects/brawl/.github/workflows/deploy-pages.yml` - GitHub Pages deployment
- `/home/louis/projects/brawl/proxy/main.py` - Flask proxy for static IP

### Data Storage
- `/home/louis/projects/brawl/data/snapshots/` - 94 MB daily snapshots
- `/home/louis/projects/brawl/data/battlelogs/` - 45 MB battle logs
- `/home/louis/projects/brawl/data/latest.json` - 1.2 MB current snapshot cache
- `/home/louis/projects/brawl/data/brawlers.json` - 124 KB game reference
- `/home/louis/projects/brawl/data/achievements.json` - 620 KB milestones

---

## 11. CONCLUSION

**System Maturity:** Production-ready with thoughtful incident response design

**Greatest Strength:** Data safety architecture (raw storage + backup system + zero-overlap branches)

**Greatest Weakness:** Fragile data collection (no rate-limit handling, no alerting, git lock recovery incomplete)

**Recommended First Priority:** Add rate-limit backoff + alerting system (prevents catastrophic data loss)

**Long-Term Vision Opportunity:** Service Worker caching for offline mode + mobile app for broader reach

This codebase represents **mature, production-quality architecture** with clear operational learnings baked in. The system prioritizes data integrity, operational resilience, and user experience. Main opportunities lie in reducing duplication, adding monitoring/alerting, and implementing offline support.
