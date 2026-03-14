# Brawl Stars Club Tracker

Personal club statistics dashboard with historical tracking.

## Tech Stack

- **Data Collection**: Python 3.x
- **Storage**: JSON daily snapshots
- **Automation**: GitHub Actions (daily cron)
- **Frontend**: HTML + CSS + Chart.js
- **Hosting**: GitHub Pages

## Data Storage Structure

```
data/
  2026-03-14.json    # Daily club snapshot
  2026-03-15.json
  ...
  latest.json        # Copy of most recent snapshot
```

## Key Metrics to Track

**Player Level:**
- Total trophies (trend over time)
- Per-brawler trophies
- Brawlers owned vs total
- Maxed brawlers count
- Power level distribution
- Item collection (gadgets, SPs, HCs, buffies)
- Resources needed (gold, power points)
- Victory counts (3v3, solo, duo)

**Club Level:**
- Total club trophies
- Member count changes
- Average trophies per member
- Total maxed brawlers across club

## Dashboard Features (MVP)

**Current Stats:**
- Leaderboard (sortable by trophies, maxed brawlers, completion %)
- Individual player cards with key stats
- Club totals and averages

**Trends (Historical):**
- Trophy progression graphs (per player + club total)
- Brawler acquisition timeline
- Item collection rate (gadgets/SPs gained per week)
- Power level progression
- Activity heatmap (who's active vs inactive)

**Nice-to-Haves:**
- Per-brawler trophy tracking (see which brawlers people are pushing)
- Missing items matrix (who needs what)
- Resource calculator (gold/PP needed club-wide)
- Milestone notifications (first P11, 50k trophies, etc.)

## Considerations

**API Rate Limits:**
- Check Brawl Stars API limits (Silver tier)
- ~50 members = 51 API calls/day (club + players)
- Should be fine, but add retry logic

**Data Size:**
- ~100KB per daily snapshot
- 365 days = ~36MB/year
- Git repo will grow, consider squashing old commits yearly

**Privacy:**
- Club members only (private)
- Consider private GitHub repo OR public with anonymized names

**Optimization Later:**
- Compress old data (weekly/monthly aggregates after 30 days)
- Separate per-brawler details into dedicated files
- Add caching layer for faster page loads

## Implementation Phases

**Phase 1: Data Collection (Current)**
- [x] Python script to fetch data
- [x] Data models (models.py)
- [ ] Integration with existing main.py
- [ ] Test snapshot generation

**Phase 2: Automation**
- [ ] GitHub Actions workflow
- [ ] Scheduled daily runs (midnight UTC)
- [ ] Auto-commit to repo

**Phase 3: Basic Dashboard**
- [ ] Static HTML page
- [ ] Display latest.json stats
- [ ] Basic table with player stats
- [ ] Sortable columns

**Phase 4: Historical Trends**
- [ ] Chart.js integration
- [ ] Trophy progression graphs
- [ ] Item collection trends
- [ ] Date range selector

**Phase 5: Polish**
- [ ] Responsive design
- [ ] Dark mode toggle
- [ ] Export stats to CSV
- [ ] Player detail modals

## Notes

- Keep it simple first - iterate based on what's useful
- Brawl Stars updates add new brawlers ~monthly, handle gracefully
- API schema might change, add validation
- Consider webhook notifications (Discord?) for milestones
