# Main to V2 Data Integration

Procedure for integrating new data from `main` branch into `v2` branch.

## When to Run

Run this after `main` branch receives new snapshots or battlelogs from Oracle VM collection scripts. Check for new files:
- `data/snapshots/YYYY-MM-DD.json` (daily snapshots)
- `data/battlelogs/*.json` (battlelog updates)

## Prerequisites

1. **Clean v2 state**: No uncommitted changes
   ```bash
   git checkout v2
   git status  # Should show clean working tree
   ```

2. **Note current commit**: Record hash for rollback if needed
   ```bash
   git rev-parse HEAD  # Save this hash
   ```

3. **Verify main has new data**:
   ```bash
   git fetch origin main
   git diff v2 origin/main -- data/
   ```

## Integration Steps

### 1. Merge main branch

```bash
git merge origin/main
```

**Expected**: Merge conflicts in `data/` (main has flat structure, v2 has compressed structure). Accept all conflicts temporarily - we'll fix structure in next steps.

### 2. Move new snapshots to raw/

```bash
# Find new snapshot files (not yet in v2)
ls data/snapshots/*.json

# Move to raw/ structure
mv data/snapshots/*.json data/raw/snapshots/
```

### 3. Move battlelogs to raw/

**CRITICAL**: Main may not update all players. Check count before deleting old compressed files.

```bash
# Count players in main's battlelogs
ls data/battlelogs/*.json | wc -l

# Expected: 11 players (or check CLAUDE.md for current count)
# If fewer than expected, some players not updated - need restore later
```

Delete old compressed battlelogs, move new ones:

```bash
rm data/raw/battlelogs/*.gz
mv data/battlelogs/*.json data/raw/battlelogs/
```

### 4. Restore missing players (if needed)

If step 3 showed fewer than expected players, restore from v2's pre-merge state:

```bash
# Example: Restore 4 players main didn't update
git checkout <pre-merge-hash> -- data/raw/battlelogs/2LGCLLPU2.json.gz
git checkout <pre-merge-hash> -- data/raw/battlelogs/JJ8P8URQC.json.gz
git checkout <pre-merge-hash> -- data/raw/battlelogs/R0CUY9PR.json.gz
git checkout <pre-merge-hash> -- data/raw/battlelogs/Y9G0QL9GL.json.gz
```

Replace `<pre-merge-hash>` with hash from Prerequisites step 2.

### 5. Compress new files

```bash
uv run python scripts/migrate_to_compressed.py
```

**Expected output**: Compression stats showing 93%+ reduction for new files.

### 6. Regenerate aggregated data

```bash
uv run python scripts/aggregate.py
```

**Expected output**:
- Snapshot count matches historical range
- All tracked players present with battle counts
- Achievement count increases

### 7. Clean up old flat files

Remove metadata files from main's flat structure:

```bash
rm -f data/achievements.json
rm -f data/latest.json
rm -f data/battlelogs/_last_updated.json
rm -f data/snapshots/_last_updated.json
```

Remove now-empty directories:

```bash
rm -rf data/battlelogs/
rm -rf data/snapshots/
```

### 8. Stage and commit

```bash
git add -A
git status  # Verify changes look correct

git commit -m "Merge main into v2 with data migration

Integrated snapshots through YYYY-MM-DD from main into v2's compressed structure. Migrated to data/raw/, compressed files, regenerated aggregated data. [Add note if restored players]. Cleaned up old flat files."
```

## Validation Checklist

After commit, verify integration success:

```bash
# 1. Check aggregated metadata
cat data/aggregated/metadata.json | jq '.total_battles, .total_snapshots, .players | length'

# 2. Verify all players present
ls data/aggregated/players/ | wc -l  # Should match tracked player count

# 3. Check snapshot date range
ls data/raw/snapshots/*.gz | head -1  # Earliest
ls data/raw/snapshots/*.gz | tail -1  # Latest

# 4. Verify compressed battlelogs exist for all players
ls data/raw/battlelogs/*.gz | wc -l  # Should match tracked player count
```

**Expected values** (as of August 2026):
- Total battles: ~22,000+
- Total snapshots: ~168 (March 14, 2026 → latest)
- Players: 11

## Troubleshooting

### Issue: Missing players after merge

**Symptom**: Aggregation shows 0 battles for some players, or player folders missing.

**Cause**: Main branch didn't update those players' battlelogs (common if player inactive).

**Fix**: Restore from v2's pre-merge compressed battlelogs (see Step 4).

### Issue: Aggregation fails with decompression error

**Symptom**: `gzip.BadGzipFile` or similar during aggregate.py.

**Cause**: Corrupted .gz file or mixing compressed/uncompressed.

**Fix**:
```bash
# Find problematic file (shown in error)
# Delete it and restore from backup or re-compress
rm data/raw/battlelogs/BADFILE.json.gz

# If main has fresh copy:
gzip -9 data/battlelogs/BADFILE.json
mv data/battlelogs/BADFILE.json.gz data/raw/battlelogs/
```

### Issue: Snapshot count doesn't increase

**Symptom**: `total_snapshots` same as before merge.

**Cause**: New snapshots not moved to data/raw/snapshots/, or already existed.

**Fix**: Check if main actually had new snapshots:
```bash
git show origin/main:data/snapshots/ | grep json
```

## Rollback Procedure

If integration corrupts data:

```bash
# Reset to pre-merge state
git reset --hard <pre-merge-hash>

# Clean any untracked files
git clean -fd

# Verify clean state
git status
```

Replace `<pre-merge-hash>` with hash from Prerequisites step 2.

## Notes

- **Main structure**: Flat files at `data/snapshots/*.json`, `data/battlelogs/*.json`
- **V2 structure**: Compressed raw at `data/raw/**/*.json.gz`, aggregated at `data/aggregated/**/*.json`
- **Frequency**: Run as needed when main gets new data (typically daily for snapshots, every 30min for battlelogs)
- **Duration**: ~2-5 minutes depending on data volume
