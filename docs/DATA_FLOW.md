# Data Flow: Aggregation → Frontend

**Purpose:** Define relationship between aggregated data outputs and frontend UI. Ensures aggregation generates exactly what frontend needs, no orphaned data.

**Update policy:** Modify this doc when changing aggregation schema OR frontend requirements.

---

## Overview Tab

**Summary:** High-level stats for all tracked players (club members + individual friends). Quick stats, trophy timeline (last 30 days default), and dynamic leaderboards.

### Section 1: Quick Stats

**Data source:** `data/aggregated/club-summary.json` → `quick_stats`

**Fields used:**
- `total_members` (int) - Count of all tracked players
- `total_trophies` (int) - Sum of trophies across all players
- `total_battles` (int) - Sum of battles from all battlelogs
- `avg_winrate` (float) - Overall win rate across all players, all modes
- `fav_mode` (string) - Most played mode club-wide (e.g., "gemGrab")

**Display:** 5 stat cards in grid layout

**Notes:**
- "Total Members" includes club members + individual tracked players
- "Avg Win Rate" calculated from all battle types (ranked, soloRanked, friendly, challenge)
- "Favorite Mode" determined by total games across all players

---

### Section 2: Trophy Timeline Chart

**Data source:** `data/aggregated/club-summary.json` → `trophy_timeline`

**Fields:**
- Array of `{date, players}`
  - `date` (string) - ISO date (YYYY-MM-DD)
  - `players` (object) - Map of `{tag: trophies}`

**UI:**
- Default: Show last 30 entries only
- Toggle: "Show All" displays full array
- Frontend slices array based on toggle state

**Notes:**
- Send full history array (166+ days)
- Frontend filters to last 30 by default
- No duplication (single array)

---

### Section 3: Leaderboards

**Data source:** `data/aggregated/club-summary.json` → `leaderboards`

**Always-shown leaderboards:**

1. **Account Trophies**
   - Field: `leaderboards.trophies[]`
   - Entry: `{tag, name, value}` where value = current trophies
   - Sort: Descending by value

2. **Ranked Best Rank**
   - Field: `leaderboards.ranked_best[]`
   - Entry: `{tag, name, value}` where value = highestAllTimeRankedRank (int, lower = better)
   - Sort: Ascending by value (rank 1 = best)
   - Notes: From snapshot `highestAllTimeRankedRank`, frontend config maps int → rank name

3. **Win Rate**
   - Field: `leaderboards.winrate[]`
   - Entry: `{tag, name, value}` where value = win rate (0.0-1.0)
   - Sort: Descending by value
   - Notes: All modes/maps combined, all battle types

4. **Total Battles**
   - Field: `leaderboards.total_battles[]`
   - Entry: `{tag, name, value}` where value = total games played
   - Sort: Descending by value

5. **Maxed Brawlers**
   - Field: `leaderboards.maxed_brawlers[]`
   - Entry: `{tag, name, value}` where value = count of fully maxed brawlers (power 11, all items)
   - Sort: Descending by value

6. **Brawlers 1000+ Trophies**
   - Field: `leaderboards.brawlers_1k[]`
   - Entry: `{tag, name, value}` where value = count of brawlers with 1000+ trophies
   - Sort: Descending by value

**Dynamic leaderboards (conditional):**

7. **Brawlers 2000+ Trophies**
   - Field: `leaderboards.brawlers_2k[]` (only present if any player has brawler >= 2000)
   - Entry: `{tag, name, value}`
   - Sort: Descending by value

8. **Brawlers 3000+ Trophies**
   - Field: `leaderboards.brawlers_3k[]` (only present if threshold met)
   - Entry: `{tag, name, value}`
   - Sort: Descending by value

**Display:** Mimic v1 behavior (side-by-side cards, each leaderboard shows top N players)

**Notes:**
- Dynamic leaderboards (2k+, 3k+) only included in aggregation output if threshold met
- Frontend renders all present leaderboards in order
- Pattern continues for higher thresholds (4k+, 5k+, etc.) if needed

---

## Aggregation Output Structure

**File:** `data/aggregated/club-summary.json`

```json
{
  "version": 1,
  "generated_at": "2026-08-25T15:30:00Z",

  "quick_stats": {
    "total_members": 11,
    "total_trophies": 389420,
    "total_battles": 12450,
    "avg_winrate": 0.576,
    "fav_mode": "gemGrab"
  },

  "trophy_timeline": [
    {
      "date": "2026-03-14",
      "players": {
        "2L0U0PGRL": 32100,
        "2LGCLLPU2": 30500,
        ...
      }
    },
    {
      "date": "2026-03-15",
      "players": {...}
    },
    ...
  ],

  "leaderboards": {
    "trophies": [
      {"tag": "2L0U0PGRL", "name": "Louis", "value": 35420},
      {"tag": "2LGCLLPU2", "name": "Player2", "value": 32100},
      ...
    ],
    "ranked_best": [
      {"tag": "2L0U0PGRL", "name": "Louis", "value": 16},
      ...
    ],
    "winrate": [
      {"tag": "2L0U0PGRL", "name": "Louis", "value": 0.612},
      ...
    ],
    "total_battles": [
      {"tag": "2L0U0PGRL", "name": "Louis", "value": 1250},
      ...
    ],
    "maxed_brawlers": [
      {"tag": "2L0U0PGRL", "name": "Louis", "value": 12},
      ...
    ],
    "brawlers_1k": [
      {"tag": "2L0U0PGRL", "name": "Louis", "value": 18},
      ...
    ],
    "brawlers_2k": [
      {"tag": "2L0U0PGRL", "name": "Louis", "value": 3},
      ...
    ]
    // brawlers_3k, brawlers_4k, etc. only present if threshold met
  }
}
```

**Size estimate:** ~50-60 KB

---

## Notes

**Terminology:**
- "Club" → "Tracked players" or "Group" (includes club members + individual friends)
- Avoid "club-wide" language in frontend

**Version field:**
- `version: 1` allows future schema changes
- Frontend can check version, handle backwards compatibility

**Generation frequency:**
- On v2 branch: Manual (run `python src/aggregation/aggregate.py`)
- After merge: GitHub Actions on every data push to main

---

## Player Stats Tab

**Summary:** Detailed stats for selected player. Current stats, trophy progression, game mode breakdown, and performance metrics.

**Note:** Player Stats tab incomplete - additional sections to be defined.

### Player Selection

**Data source:** `data/aggregated/indexes/players.json`

**Fields:**
- Array of `{tag, name, trophies}`
- Sorted by trophies descending

**UI:** Clickable name buttons (not dropdown)

---

### Section 1: Player Quick Stats

**Data source:** `data/aggregated/players/{TAG}/stats.json` → `current`

**Fields:**
- `trophies` (int) - Current account trophies
- `ranked_rank` (int) - Current ranked rank number (frontend maps to name via config)
- `brawlers_owned` (int) - Count of brawlers owned
- `maxed_brawlers` (int) - Count of fully maxed brawlers

**UI:** Stat cards, title = player name

**Notes:**
- From latest snapshot
- Frontend config maps `ranked_rank` → rank name (e.g., 12 → "DIAMOND III")

---

### Section 2: Trophy Progression

**Data source:** `data/aggregated/players/{TAG}/timeline.json` → `data[]`

**Fields:**
- Array of `{date, trophies}`
  - `date` (string) - ISO date (YYYY-MM-DD)
  - `trophies` (int)

**UI calculations (frontend):**
- Yesterday offset: `trophies[latest] - trophies[latest-1]`
- Last week offset: `trophies[latest] - trophies[latest-7]`
- Last month offset: `trophies[latest] - trophies[latest-30]`
- Chart: Dropdown filters (All time, Last month, Last week, Yesterday)

**Notes:**
- Send full array, frontend filters based on dropdown selection
- "Yesterday" = last available snapshot (captured end of day)
- Latest = most recent snapshot in array

---

### Section 3: Game Mode Wins

**Data source:** `data/aggregated/players/{TAG}/stats.json` → `mode_wins`

**Fields:**
- `3vs3_victories` (int) - From snapshot `3vs3Victories`
- `solo_victories` (int) - From snapshot `soloVictories`
- `duo_victories` (int) - From snapshot `duoVictories`
- `total_victories` (int) - Sum of above

**Notes:**
- From latest snapshot

---

### Section 4: Game Mode Distribution

**Data source:** `data/aggregated/players/{TAG}/battle-stats.json` → `mode_distribution`

**Fields:**
- Array of `{mode, games, percentage}`
  - `mode` (string) - Raw mode name (e.g., "gemGrab")
  - `games` (int)
  - `percentage` (float) - 0.0-100.0

**Notes:**
- Aggregation sends raw mode names
- Frontend config maps mode names (e.g., "gemGrab" → "Gem Grab")
- Across ALL battlelogs for player

---

### Section 5: Performance Stats

**Data source:** `data/aggregated/players/{TAG}/battle-stats.json` → `performance`

**Fields:**
- `overall_winrate` (float) - 0.0-1.0
- `wins` (int)
- `losses` (int)
- `best_mode` (object)
  - `mode` (string) - Raw mode name
  - `winrate` (float) - 0.0-1.0
  - `games` (int)
- `mvp_rate` (float) - 0.0-1.0 (percentage of games as starPlayer)
- `mvp_count` (int) - Total starPlayer occurrences
- `total_games` (int)
- `most_mvp_brawler` (object)
  - `brawler` (string) - Brawler name
  - `mvp_count` (int)

**Notes:**
- `best_mode` = highest win rate among modes with >= 10 games
- MVP from `battle.starPlayer.tag` matching player tag (3v3 modes only)
- All battle types included (ranked, soloRanked, friendly, challenge)
- Frontend formats percentages (0.576 → "57.6%")

---

### Section 6: Brawler Performance

**Data source:** `data/aggregated/players/{TAG}/battle-stats.json` → `brawler_stats`

**UI derives top 5:**
- Highest win rate: Sort `brawler_stats` by `winrate` desc, take 5
- Most played: Sort by `games` desc, take 5
- Highest trophies: Get from `brawlers.json`, sort by `trophies` desc, take 5
- Most MVPs: Sort `brawler_stats` by `mvp_count` desc, take 5

**Notes:**
- No separate aggregation needed (frontend extracts from full list)

---

### Section 7: Brawlers Battle Stats

**Data source:** `data/aggregated/players/{TAG}/battle-stats.json` → `brawler_stats`

**Fields:**
- Array of `{brawler, games, winrate, net_trophies, last_played, mvp_count}`
  - `brawler` (string) - Brawler name
  - `games` (int) - Games played with this brawler
  - `winrate` (float) - 0.0-1.0
  - `net_trophies` (int) - Sum of trophyChange across all battles
  - `last_played` (string) - Relative time ("Today", "2 days ago", etc.)
  - `mvp_count` (int) - StarPlayer occurrences

**UI:**
- Default: Top 10 by games played
- Toggle: Show all owned brawlers
- All columns sortable except brawler name

**Notes:**
- Only includes brawlers player owns
- `last_played` calculated from most recent battle timestamp

---

### Section 8: Teammate Chemistry

**Data source:** `data/aggregated/players/{TAG}/battle-stats.json` → `teammate_chemistry`

**Fields:**
- Array of `{tag, name, winrate, games, wins, losses}`
  - `tag` (string) - Teammate tag
  - `name` (string) - Teammate name
  - `winrate` (float) - 0.0-1.0
  - `games` (int) - Games played together
  - `wins` (int)
  - `losses` (int)
- Sorted by winrate descending

**Notes:**
- From battles where both players on same team
- Only tracked players (club members + individual friends)

---

### Section 9: Prestige Distribution

**Data source:** `data/aggregated/players/{TAG}/stats.json` → `prestige_distribution`

**Fields:**
- Array of `{prestige_level, count}`
  - `prestige_level` (int) - 0 = <1000 trophies, 1 = >=1000, 2 = >=2000, etc.
  - `count` (int) - Number of brawlers at this prestige

**UI:** Bar chart, colors match game (P0 white, P1 purple, P2 red, P3+ yellow)

**Notes:**
- From player's owned brawlers only
- Frontend config defines prestige colors

---

### Section 10: Power Level Distribution

**Data source:** `data/aggregated/players/{TAG}/stats.json` → `power_distribution`

**Fields:**
- Array of `{power_level, count}`
  - `power_level` (int) - 1-11
  - `count` (int) - Number of brawlers at this power

**UI:** Bar chart

**Notes:**
- From player's owned brawlers only

---

### Section 11: Account Worth

**Data source:** `data/aggregated/players/{TAG}/brawlers.json`

**Fields:**
- Full list of player's brawlers with power/items (used by frontend for calculation)
- Array of `{name, power, gadget_ids, star_power_ids, hyper_charge_ids, gear_ids, trophies, prestige}`

**Reference data:** `data/raw/metadata/brawlers.json` (available items per brawler)

**UI calculations (frontend, using config):**
- Current worth coins/PP: Sum spent on owned brawlers
- Cost to max coins/PP: Remaining cost to max all (owned + unowned)
- Progress %: `current_worth_coins / (current_worth + cost_to_max) * 100`
- Missing counts: Gadgets/SP/HC missing across all brawlers

**Notes:**
- Frontend uses `GameConstants.COIN_COSTS`, `POWER_POINT_COSTS`, `ITEM_COSTS` from config
- Excludes unreleased brawlers (defined in frontend config)
- Does not include gears/buffies in cost calculations (as per v1)

---

### Section 12: Brawler Detail Table

**Data source:** `data/aggregated/players/{TAG}/brawlers.json`

**Fields:**
- Array of `{name, power, gadget_ids, star_power_ids, hyper_charge_ids, gear_ids, trophies, prestige}`
- For unowned brawlers: `{name, owned: false}`

**Reference data:** `data/raw/metadata/brawlers.json` (item names, available items)

**UI:**
- Table columns: Brawler, Power, Gadgets, Star Powers, Hypercharge, Gears
- Shows owned + unowned brawlers (unowned marked with "❌ Not Owned")
- Row colors: maxed (all items), missing items, almost maxed, not owned
- Sortable, searchable

**Notes:**
- Frontend resolves item IDs to names using brawlers.json reference
- Item display: badges with item names, "Missing" badge if slot empty
- Owned brawlers at top, unowned at bottom

---

## Aggregation Output Structure (Player Stats)

**File:** `data/aggregated/players/{TAG}/stats.json`

```json
{
  "version": 1,

  "current": {
    "trophies": 35420,
    "ranked_rank": 12,
    "brawlers_owned": 85,
    "maxed_brawlers": 12
  },

  "mode_wins": {
    "3vs3_victories": 4520,
    "solo_victories": 1930,
    "duo_victories": 850,
    "total_victories": 7300
  },

  "prestige_distribution": [
    {"prestige_level": 0, "count": 25},
    {"prestige_level": 1, "count": 40},
    {"prestige_level": 2, "count": 15},
    {"prestige_level": 3, "count": 5}
  ],

  "power_distribution": [
    {"power_level": 9, "count": 10},
    {"power_level": 10, "count": 35},
    {"power_level": 11, "count": 40}
  ]
}
```

**File:** `data/aggregated/players/{TAG}/timeline.json`

```json
{
  "version": 1,

  "data": [
    {"date": "2026-03-14", "trophies": 32100},
    {"date": "2026-03-15", "trophies": 32250},
    ...
  ]
}
```

**File:** `data/aggregated/players/{TAG}/battle-stats.json`

```json
{
  "version": 1,

  "mode_distribution": [
    {"mode": "gemGrab", "games": 350, "percentage": 28.0},
    {"mode": "brawlBall", "games": 280, "percentage": 22.4},
    ...
  ],

  "performance": {
    "overall_winrate": 0.576,
    "wins": 720,
    "losses": 530,
    "total_games": 1250,
    "best_mode": {
      "mode": "knockout",
      "winrate": 0.68,
      "games": 145
    },
    "mvp_rate": 0.24,
    "mvp_count": 300,
    "most_mvp_brawler": {
      "brawler": "CROW",
      "mvp_count": 45
    }
  },

  "brawler_stats": [
    {
      "brawler": "CROW",
      "games": 145,
      "winrate": 0.72,
      "net_trophies": 320,
      "last_played": "Today",
      "mvp_count": 45
    },
    ...
  ],

  "teammate_chemistry": [
    {
      "tag": "2LGCLLPU2",
      "name": "Friend1",
      "winrate": 0.68,
      "games": 230,
      "wins": 156,
      "losses": 74
    },
    ...
  ]
}
```

**File:** `data/aggregated/players/{TAG}/brawlers.json`

```json
{
  "version": 1,

  "brawlers": [
    {
      "name": "CROW",
      "power": 11,
      "trophies": 1793,
      "prestige": 2,
      "gadget_ids": [23000182, 23000183],
      "star_power_ids": [23000094, 23000095],
      "hyper_charge_ids": [23000300],
      "gear_ids": [23000001, 23000002, 23000003, 23000004, 23000005, 23000006]
    },
    ...
  ],

  "unowned": [
    {"name": "SHELLY", "owned": false},
    {"name": "NITA", "owned": false},
    ...
  ]
}
```

**Size estimates:**
- `stats.json`: ~2 KB
- `timeline.json`: ~5 KB
- `battle-stats.json`: ~12 KB (reduced, no brawler_performance duplication)
- `brawlers.json`: ~25 KB
- **Total per player:** ~44 KB

**Notes:**
- `tag`/`name` removed from all player files (derive from `indexes/players.json`)
- `brawler_performance` removed (frontend extracts top 5 from `brawler_stats`)

---

---

## Achievements Tab

**Summary:** Timeline of player milestones (new brawlers, prestige levels, maxed brawlers, items unlocked, trophy milestones). Filterable by player, date range, and achievement type.

### Data Source

**File:** `data/achievements.json` (copied as-is from raw data, no transformation)

**Size:** ~150 KB (3747 achievements as of Aug 2026)

**Structure:** Array of achievement objects
```json
{
  "date": "2026-08-14",
  "player_tag": "#98QG0VCJ2",
  "player_name": "JOEL | køkønut",
  "type": "new_brawler",
  "brawler": "WENDY",
  "item_name": null,  // For gadget/star_power/hypercharge
  "item_id": null,
  "prestige_level": null,  // For prestige/first_prestige_level
  "milestone_value": null  // For trophy_milestone/total_prestiges
}
```

### Filters (Client-Side)

1. **Player Dropdown:** All players + "All Players" option
2. **Date Range:** All time / Last 7 days / Last 30 days
3. **Type Checkboxes (9 types):**
   - Trophy Milestones (🏅)
   - First Prestige Levels (⭐)
   - Total Prestiges (💎)
   - Prestige (🏆)
   - Maxed Brawlers (👑)
   - New Brawlers (🎮)
   - Hypercharges (icon)
   - Star Powers (icon)
   - Gadgets (icon)

### Display

- Grouped by date (newest first)
- Each achievement shows: icon + player name + description
- Count of filtered achievements in header
- Achievements description examples:
  - "Unlocked WENDY"
  - "Maxed out NORI"
  - "Got gadget WIND-POWERED for WENDY"
  - "Reached prestige 2 with COLT"
  - "Reached 30k trophies"

**Aggregation Strategy:** Send entire `achievements.json` unchanged. No pre-filtering or bucketing—users need access to all achievements for flexible filtering.

---

## Battles Tab

**Summary:** Paginated battle feed with filters. Shows all battles with tracked players. Automatically merged when multiple tracked players in same match.

### Data Source

**Files:** 7-day segments in `data/aggregated/battles/`
- `recent.json` - Last 7 days (~800KB)
- `week-2.json` - 8-14 days ago (~600KB)
- `week-3.json` - 15-21 days ago (~500KB)
- `week-4.json` - 22-28 days ago (~400KB)
- `older.json` - 29+ days ago (~5MB+)

**Structure:** Flat array of deduplicated battles with player-centric format

**File Format:** Array of battle objects
```json
{
  "battleTime": "20260826T134521.000Z",
  "mode": "brawlBall",
  "map": "Sneaky Fields",
  "type": "ranked",
  "players": [
    {
      "tag": "#98QG0VCJ2",
      "name": "JOEL | køkønut",
      "brawler": "COLT",
      "power": 11,
      "trophies": 2143,
      "trophyChange": 8,         // non-null = tracked player
      "result": "victory",
      "team": 0
    },
    {
      "tag": "#LLJGJQVY",
      "name": "JOEL | Escorte",
      "brawler": "NAJIA",
      "power": 11,
      "trophies": 1234,
      "trophyChange": 8,         // non-null = tracked player
      "result": "victory",
      "team": 0
    },
    {
      "tag": "#EXTERNAL1",
      "name": "Random Player",
      "brawler": "SHELLY",
      "power": 9,
      "trophies": 500,
      "trophyChange": null,      // null = not tracked
      "result": "victory",
      "team": 0
    },
    // ... 3 opponents on team: 1
  ]
}
```

**Duels/tagTeam modes:** Tracked players include `brawlers` array
```json
{
  "tag": "#98QG0VCJ2",
  "name": "JOEL | køkønut",
  "brawler": "MEEPLE",           // primary (first used)
  "power": 11,
  "trophies": 1025,
  "brawlers": [                  // all 3 brawlers
    {"name": "MEEPLE", "power": 11, "trophies": 1025, "trophyChange": 6},
    {"name": "CHARLIE", "power": 11, "trophies": 1065, "trophyChange": 6},
    {"name": "SIRIUS", "power": 11, "trophies": 1167, "trophyChange": 4}
  ],
  "trophyChange": 16,            // sum of all 3
  "result": "victory",
  "team": 0
}
```

### Deduplication & Merging

- **Dedup key:** `(battleTime, mode)`
- When multiple tracked players in same battle, data merged into single battle entry
- Each tracked player gets individual `trophyChange` from their battlelog
- Non-tracked players: `trophyChange = null` (detection via `!== null`)
- Special cases (API missing trophy data): tracked player gets `trophyChange = 0`

### Filters (Client-Side)

1. **Player Filter:** Show battles where specific tracked player participated
2. **Mode Filter:** Filter by game mode (brawlBall, gemGrab, etc.)
3. **Result Filter:** Win / Loss / Draw (based on tracked player's result)

### Display

- Battles grouped by date (newest first)
- Compact cards showing:
  - Tracked players who participated (name + brawler + trophyChange)
  - Game mode (centered)
  - Time ago + expand arrow
- Color-coded by result: green (win), red (loss), grey (draw)
- Click to expand full battle details

### Data Loading Strategy

**Implementation:** 7-day segmented loading

1. Frontend loads `recent.json` on tab open (~800KB)
2. Older segments loaded on-demand when user scrolls or filters
3. Segments cached in memory for session duration

**Benefits:**
- Initial load fast (~800KB vs 39MB)
- Most users only view recent battles
- Historical data available when needed

**Size Breakdown:**
- Total: ~39MB across all segments, 21,626 battles
- Average: ~1.8KB per battle
- Tracked player entries: 29,041 (24,122 with real trophy data, 4,919 placeholders)

---

**Last Updated:** 2026-08-26
**Status:**
- ✅ Overview Tab complete
- ✅ Player Stats Tab complete (12 sections)
- ❌ Timelines Tab removed (not planned)
- ✅ Achievements Tab complete (pass-through, no aggregation)
- ✅ Battles Tab complete (deduplicated 7-day segments)
