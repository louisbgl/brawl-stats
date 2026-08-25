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

**Data source:** `data/aggregated/players/{TAG}/battle-stats.json` → `brawler_performance`

**Fields:**
- `highest_winrate[]` - Top 5 brawlers by win rate
  - `{brawler, winrate}` where winrate = 0.0-1.0
- `most_played[]` - Top 5 brawlers by games played
  - `{brawler, games}`
- `highest_trophies[]` - Top 5 brawlers by trophy count
  - `{brawler, trophies}`
- `most_mvps[]` - Top 5 brawlers by MVP count
  - `{brawler, mvp_count}`

**Notes:**
- 4 separate arrays, each with top 5 brawlers
- From battlelog data (except trophies from snapshot)

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
  "tag": "2L0U0PGRL",
  "name": "Louis",

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
  "tag": "2L0U0PGRL",
  "name": "Louis",

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
  "tag": "2L0U0PGRL",
  "name": "Louis",

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

  "brawler_performance": {
    "highest_winrate": [
      {"brawler": "CROW", "winrate": 0.72},
      {"brawler": "SPIKE", "winrate": 0.68},
      ...
    ],
    "most_played": [
      {"brawler": "SHELLY", "games": 150},
      {"brawler": "COLT", "games": 120},
      ...
    ],
    "highest_trophies": [
      {"brawler": "CROW", "trophies": 1793},
      {"brawler": "SPIKE", "trophies": 1650},
      ...
    ],
    "most_mvps": [
      {"brawler": "CROW", "mvp_count": 45},
      {"brawler": "SPIKE", "mvp_count": 38},
      ...
    ]
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
  "tag": "2L0U0PGRL",
  "name": "Louis",

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
- `battle-stats.json`: ~15 KB
- `brawlers.json`: ~25 KB
- **Total per player:** ~47 KB

---

**Last Updated:** 2026-08-25
**Status:** Overview Tab complete, Player Stats Tab complete (12 sections)
