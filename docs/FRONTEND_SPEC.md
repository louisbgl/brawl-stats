# Frontend Feature Specification

## Individual Player Stats (Detailed View)

When a player is selected, show comprehensive stats:

### Overview Stats
- **Current Trophies** vs **Max Trophies** (side by side comparison)
- **Total Brawlers Owned** (count, no percentage)
- **Average Trophies per Brawler**
- **Number of Maxed Brawlers** (P11 + 2 gadgets + 2 star powers + hypercharge)

### Gamemode Wins
- 3v3 Victories
- Solo Victories
- Duo Victories
- Total Victories

### Power Level Distribution
- Bar graph showing count of brawlers at each power level (P1 through P11)
- OR a breakdown list: "X brawlers at P1, Y at P2..." etc.

### Collection Gaps
- **Missing Brawlers List** (if any)
  - Show which brawlers they don't have yet

### Per-Brawler Breakdown
Detailed table/list for EACH brawler they own showing:
- Brawler name
- Power level
- Trophy count
- **Missing items**:
  - Gadget 1 name (or "Missing")
  - Gadget 2 name (or "Missing")
  - Star Power 1 name (or "Missing")
  - Star Power 2 name (or "Missing")
  - Hypercharge name (or "Missing")
- Buffies status (Yes/No or icon)
- Gear count (e.g., "3 gears")

---

## Club Comparison Charts (Timeline Views)

Show historical progression for ALL players on same chart:

### 1. Trophy Timeline
- Line chart showing each player's trophy count over time
- ✅ Already implemented!

### 2. Gamemode Wins Timeline
- 3 separate charts or 1 chart with toggles:
  - 3v3 Victories over time
  - Solo Victories over time
  - Duo Victories over time

### 3. Brawler Collection Timeline
- Total brawlers owned over time for each player
- Shows who's collecting fastest

### 4. Maxed Brawlers Timeline
- Count of fully maxed brawlers over time
- Maxed = P11 + 2 gadgets + 2 star powers + hypercharge

### 5. Prestige Brawlers Timeline
- Count of brawlers with 1000+ trophies per player
- Shows who's pushing brawlers to rank 35+

---

## UI/UX Notes

- Keep the purple gradient theme
- Use Chart.js for all visualizations
- Mobile responsive
- Clean, organized sections
- Maybe use tabs or collapsible sections to organize all the data
- Tooltips on charts showing exact values on hover

---

## Implementation Priority

**Phase 1 (Now):**
1. Enhanced individual player stats view
2. Per-brawler breakdown table

**Phase 2:**
3. Power level distribution chart
4. Missing brawlers list

**Phase 3:**
5. Additional timeline charts (wins, collection, maxed, prestige)

**Phase 4:**
6. Polish, refinements, mobile optimization
