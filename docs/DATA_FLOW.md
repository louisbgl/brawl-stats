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

**Fields used:**
- `trophy_timeline.last_30[]` - Array of last 30 daily snapshots
  - `date` (string) - ISO date (YYYY-MM-DD)
  - `players` (object) - Map of `{tag: trophies}` for all players
- `trophy_timeline.all[]` - Full history (166+ days, same structure)

**Display:** Chart.js line chart, one line per player

**Interaction:**
- Default: Show `last_30` data only
- Toggle button: "Show All" switches to `all` data (full history)
- X-axis: dates, Y-axis: trophies
- Legend: player names (clickable to show/hide lines)

**Notes:**
- Default 30 days for faster initial load
- Full history loaded lazily on toggle

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
   - Entry: `{tag, name, value, rank_name}` where value = highestAllTimeRankedRank (lower = better), rank_name = "LEGENDARY I"
   - Sort: Ascending by value (rank 1 = best)
   - Notes: From player snapshot field `highestAllTimeRankedRank`

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

  "trophy_timeline": {
    "last_30": [
      {
        "date": "2026-07-26",
        "players": {
          "2L0U0PGRL": 35420,
          "2LGCLLPU2": 32100,
          ...
        }
      },
      ...
    ],
    "all": [
      {
        "date": "2026-03-14",
        "players": {...}
      },
      ...
    ]
  },

  "leaderboards": {
    "trophies": [
      {"tag": "2L0U0PGRL", "name": "Louis", "value": 35420},
      {"tag": "2LGCLLPU2", "name": "Player2", "value": 32100},
      ...
    ],
    "ranked_best": [
      {"tag": "2L0U0PGRL", "name": "Louis", "value": 16, "rank_name": "LEGENDARY I"},
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

**Last Updated:** 2026-08-25
**Status:** Overview Tab complete, other tabs TBD
