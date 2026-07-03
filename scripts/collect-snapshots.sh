#!/bin/bash

export PATH="$HOME/.local/bin:$PATH"
cd /home/ubuntu/brawl-stats

echo "[$(date)] Starting daily snapshot collection..."

# Backup directory for data when git operations fail
BACKUP_DIR="/home/ubuntu/brawl-stats-backup/snapshots"
mkdir -p "$BACKUP_DIR"

# Lock file to prevent concurrent execution with battlelog collection
LOCKFILE="/tmp/brawl-stats-git.lock"
LOCKFD=200
GIT_LOCK_ACQUIRED=false

# Try to acquire lock with timeout (non-blocking for data collection)
exec 200>"$LOCKFILE"
if flock -w 10 200; then
    GIT_LOCK_ACQUIRED=true
    echo "[$(date)] Git lock acquired"

    # Checkout data-snapshots branch
    git fetch origin
    git checkout data-snapshots

    # Clean up any previous merge state (but NOT data files!)
    git merge --abort 2>/dev/null || true

    # Restore any backed-up files from previous failed runs
    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
        echo "[$(date)] Restoring $(ls $BACKUP_DIR | wc -l) backed-up snapshot files..."
        cp -r "$BACKUP_DIR"/* data/ 2>/dev/null || true
        # Don't delete backup yet - wait until successfully pushed
    fi

    # Pull latest changes from data-snapshots (this will merge remote changes)
    git pull origin data-snapshots
else
    echo "[$(date)] ⚠ Could not acquire git lock - will collect data anyway and save to backup"
fi

# NOTE: We no longer merge from main to avoid conflicts with battlelogs
# Each branch now only tracks its specific files

# Run collection (this ALWAYS happens regardless of git state)
echo "[$(date)] Running data collection..."
/home/ubuntu/.local/bin/uv run python collect_data.py
COLLECTION_EXIT=$?

if [ $COLLECTION_EXIT -ne 0 ]; then
    echo "[$(date)] ✗ Data collection failed with exit code $COLLECTION_EXIT"
    exit 1
fi

echo "[$(date)] ✓ Data collection successful"

# Only attempt git operations if we have the lock
if [ "$GIT_LOCK_ACQUIRED" = true ]; then
    # Try to commit and push (but don't fail the script if this doesn't work)
    if [[ -n $(git status -s) ]]; then
        # Only add snapshot files (not battlelogs)
        git add data/snapshots/ data/latest.json data/brawlers.json
        if git commit -m "Daily data update: $(TZ='Europe/Paris' date +'%Y-%m-%d')"; then
            echo "[$(date)] Changes committed locally"

            if git push origin data-snapshots; then
                echo "[$(date)] Pushed to data-snapshots branch"

                # SUCCESS! Now we can safely delete backups
                if [ -d "$BACKUP_DIR" ]; then
                    rm -rf "$BACKUP_DIR"/*
                    echo "[$(date)] Cleared backup directory (data safely pushed)"
                fi

                # Try to merge to main
                git checkout main
                if git pull origin main; then
                    if git merge data-snapshots --no-edit -m "Merge daily snapshot: $(TZ='Europe/Paris' date +'%Y-%m-%d')"; then
                        if git push origin main; then
                            echo "[$(date)] ✓ Daily snapshot collected and merged to main"
                        else
                            echo "[$(date)] ⚠ Failed to push to main - data saved on data-snapshots branch"
                        fi
                    else
                        # Conflicts occurred - resolve automatically
                        echo "[$(date)] Resolving conflicts: keeping snapshot files, preserving battlelog files"

                        # Accept all snapshot changes from data-snapshots branch
                        git checkout --theirs data/snapshots/ data/latest.json data/brawlers.json 2>/dev/null || true

                        # Keep main's version of battlelogs (if any conflicts)
                        git checkout --ours data/battlelogs/ 2>/dev/null || true

                        git add data/

                        if git commit --no-edit -m "Merge daily snapshot: $(TZ='Europe/Paris' date +'%Y-%m-%%d')"; then
                            if git push origin main; then
                                echo "[$(date)] ✓ Daily snapshot collected and merged to main (conflicts resolved)"
                            else
                                echo "[$(date)] ⚠ Failed to push to main - data saved on data-snapshots branch"
                            fi
                        else
                            echo "[$(date)] ⚠ Failed to commit merge - data saved on data-snapshots branch"
                        fi
                    fi
                else
                    echo "[$(date)] ⚠ Failed to pull main - data saved on data-snapshots branch"
                fi
            else
                echo "[$(date)] ⚠ Failed to push - data committed locally on VM"
            fi
        else
            echo "[$(date)] ⚠ Failed to commit - data saved in working directory on VM"
        fi
    else
        echo "[$(date)] No changes detected"
    fi

    # Return to data-snapshots branch for next run
    git checkout data-snapshots 2>/dev/null || true
else
    # NO GIT LOCK: Save data to backup directory outside of git
    echo "[$(date)] ⚠ Git operations skipped - saving data to backup directory"

    # Copy all data files to backup
    cp -r data/snapshots/* "$BACKUP_DIR/" 2>/dev/null || mkdir -p "$BACKUP_DIR"
    cp data/latest.json "$BACKUP_DIR/../latest.json" 2>/dev/null || true
    cp data/brawlers.json "$BACKUP_DIR/../brawlers.json" 2>/dev/null || true

    echo "[$(date)] Data files backed up to: $BACKUP_DIR"
    echo "[$(date)] These will be committed on next successful git lock acquisition"
fi
