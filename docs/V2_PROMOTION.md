# V2 Promotion to Main

One-time procedure to replace main branch with v2 architecture.

**Note**: For routine data syncing from main to v2, use `scripts/sync_from_main.py` instead (see below).

## Overview

**What changes**:
- Data structure: Flat files → Compressed raw + aggregated
- Collection scripts: v1 → v2 (compressed output)
- Aggregation: Inline during collection → Separate aggregate.py step
- GitHub workflows: Update achievement generation

**What stays**:
- Data collection branches (`data-snapshots`, `data-battlelogs`) still used by VM
- Frontend already uses v2 paths, no changes needed
- Oracle VM collection schedule unchanged

## Routine Data Syncing (Before Promotion)

While v2 is still a separate branch, use the automated sync tool to pull new data from main:

```bash
# Preview what would sync
python scripts/sync_from_main.py --dry-run

# Actually sync data
python scripts/sync_from_main.py --execute
```

The tool automatically:
- Detects new snapshots and updated battlelogs
- Extracts and compresses files from main
- Updates metadata timestamps
- Regenerates aggregated data
- Reports what changed

This keeps v2 branch up-to-date with main's data collection without manual file copying.

## Prerequisites

### 1. Verify v2 ready

```bash
git checkout v2
git pull origin v2

# Check all systems working
uv run python src/collection/collect_snapshots_v2.py  # Should complete without errors
uv run python src/collection/collect_battlelogs_v2.py  # Should complete without errors
uv run python scripts/aggregate.py  # Should regenerate aggregated data

# Verify frontend loads
python3 -m http.server 8000  # Visit localhost:8000, check all tabs work
```

### 2. Backup current main

```bash
git checkout main
git pull origin main

# Tag current main for rollback
git tag v1-final
git push origin v1-final
```

### 3. Document current state

Record for rollback:
- Latest snapshot date in main
- Total battle count
- Last commit hash: `git rev-parse HEAD`

## Promotion Steps

### 1. Hard replace main with v2

```bash
# Checkout v2
git checkout v2
git pull origin v2

# Force main to match v2 exactly
git checkout -B main
git push origin main --force
```

**WARNING**: This overwrites main branch history. Use `--force` with caution.

### 2. Update Oracle VM collection scripts

SSH to VM:
```bash
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132
```

Update snapshot collection:
```bash
# Edit /home/ubuntu/collect-snapshots.sh
# Change: uv run python collect_data.py
# To:     uv run python src/collection/collect_snapshots_v2.py

nano /home/ubuntu/collect-snapshots.sh
```

Update battlelog collection:
```bash
# Edit /home/ubuntu/collect-battlelogs.sh
# Change: uv run python collect_battlelogs.py
# To:     uv run python src/collection/collect_battlelogs_v2.py

nano /home/ubuntu/collect-battlelogs.sh
```

Add aggregation step (runs after snapshot collection):
```bash
# Edit /home/ubuntu/collect-snapshots.sh
# After v2 collection script, add:
# uv run python scripts/aggregate.py

nano /home/ubuntu/collect-snapshots.sh
```

Pull latest code on VM:
```bash
cd /home/ubuntu/brawl-stats
git fetch origin
git checkout main
git pull origin main
```

Test scripts manually:
```bash
/home/ubuntu/collect-snapshots.sh
/home/ubuntu/collect-battlelogs.sh

# Check logs
tail -50 /home/ubuntu/collect-snapshots.log
tail -50 /home/ubuntu/collect-battlelogs.log
```

### 3. Update GitHub Actions

Edit `.github/workflows/generate-achievements.yml`:

**Before**:
```yaml
- name: Generate achievements
  run: uv run python generate_achievements.py

- name: Commit and push changes
  run: |
    git add data/achievements.json
```

**After**:
```yaml
- name: Regenerate aggregated data
  run: uv run python scripts/aggregate.py

- name: Commit and push changes
  run: |
    git add data/aggregated/
```

Commit and push workflow change:
```bash
git add .github/workflows/generate-achievements.yml
git commit -m "Update achievement workflow for v2 structure"
git push origin main
```

### 4. Verify deployment

Check GitHub Pages builds:
```bash
# Visit: https://github.com/louisbgl/brawl-stats/actions
# Ensure deploy-pages.yml succeeds
```

Visit live site:
```
https://louisbgl.github.io/brawl-stats/
```

Verify all tabs load with data.

### 5. Clean up branches (optional)

Delete v2 branch (now merged to main):
```bash
git branch -d v2
git push origin --delete v2
```

Keep data collection branches (still needed):
- `data-snapshots` - Used by VM snapshot collection
- `data-battlelogs` - Used by VM battlelog collection

## Data Collection Flow After Promotion

### VM → Data Branches → Main

**Snapshot collection** (daily at 23:00 UTC):
1. VM runs `collect_snapshots_v2.py` → saves to `data/raw/snapshots/*.json.gz`
2. Commits to `data-snapshots` branch
3. Merges `data-snapshots` → `main`
4. Runs `aggregate.py` to update `data/aggregated/`
5. Commits aggregated data to `main`

**Battlelog collection** (every 30 min):
1. VM runs `collect_battlelogs_v2.py` → saves to `data/raw/battlelogs/*.json.gz`
2. Commits to `data-battlelogs` branch
3. Merges `data-battlelogs` → `main`
4. (No aggregation step - happens on next snapshot collection)

**GitHub Actions** (on main push):
1. Detects new data in `data/aggregated/`
2. (Optional) Re-runs aggregate.py if needed
3. Deploys to GitHub Pages if frontend changed

## Breaking Changes

### Collection Scripts
- **Old**: `collect_data.py`, `collect_battlelogs.py`
- **New**: `src/collection/collect_snapshots_v2.py`, `src/collection/collect_battlelogs_v2.py`
- **Change**: Different paths, compression enabled, no inline aggregation

### Data Paths
- **Old**: `data/snapshots/*.json`, `data/battlelogs/*.json`, `data/achievements.json`
- **New**: `data/raw/**/*.json.gz`, `data/aggregated/**/*.json`
- **Impact**: Any external tools reading data need path updates

### Aggregation Timing
- **Old**: Achievements generated by GitHub Actions after each push
- **New**: All aggregation runs during snapshot collection (or manually via `aggregate.py`)
- **Impact**: Achievements update once daily instead of per-push

### File Sizes
- **Old**: Large JSON files (1-5 MB per snapshot)
- **New**: Compressed .gz files (50-300 KB, ~93% reduction)
- **Impact**: Faster git operations, smaller repo

## Rollback Procedure

If promotion fails, restore v1:

```bash
# Restore main to v1-final tag
git checkout v1-final
git checkout -B main
git push origin main --force

# Restore VM scripts
ssh ubuntu@129.151.245.132
cd /home/ubuntu/brawl-stats
git checkout main
git pull origin main

# Edit collect-snapshots.sh and collect-battlelogs.sh back to v1 commands
nano /home/ubuntu/collect-snapshots.sh
nano /home/ubuntu/collect-battlelogs.sh
```

## Post-Promotion Tasks

1. **Update CLAUDE.md**: Change references from "v2 architecture" to current state
2. **Monitor first collection**: Watch VM logs on next scheduled run
3. **Verify aggregation**: Check `data/aggregated/metadata.json` updates daily
4. **Test GitHub Pages**: Confirm site updates with new data

## Timeline

**Recommended promotion time**: After successful manual test collection on VM, before next scheduled run (before 23:00 UTC).

**Duration**: ~30 minutes for all steps

**Risk window**: First automated collection (next day) - monitor logs

## Validation Checklist

After promotion, verify:

- [ ] VM scripts updated and tested
- [ ] GitHub Actions workflow updated
- [ ] Live site loads all tabs with data
- [ ] First automated collection succeeds
- [ ] Data appears in `data/aggregated/` on main
- [ ] GitHub Pages deploys successfully
- [ ] All players present in aggregated data
- [ ] Battle counts match or exceed pre-promotion

## Notes

- **Data branches**: `data-snapshots` and `data-battlelogs` remain active (VM still uses them)
- **Main branch**: Becomes v2 architecture permanently
- **Frontend**: Already compatible, no changes needed
- **Backfill**: All historical data preserved in v2 migration, no re-collection needed
