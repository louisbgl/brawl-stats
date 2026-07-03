#!/bin/bash

export PATH="$HOME/.local/bin:$PATH"
cd /home/ubuntu/brawl-stats

echo "[$(date)] Starting battlelog collection..."

# Backup directory for data when git operations fail
BACKUP_DIR="/home/ubuntu/brawl-stats-backup/battlelogs"
mkdir -p "$BACKUP_DIR"

# Lock file to prevent concurrent execution with snapshot collection
LOCKFILE="/tmp/brawl-stats-git.lock"
LOCKFD=200
GIT_LOCK_ACQUIRED=false

# Try to acquire lock with timeout (non-blocking for data collection)
exec 200>"$LOCKFILE"
if flock -w 10 200; then
    GIT_LOCK_ACQUIRED=true
    echo "[$(date)] Git lock acquired"

    # Checkout data-battlelogs branch
    git fetch origin
    git checkout data-battlelogs

    # Clean up any previous merge state (but NOT data files!)
    git merge --abort 2>/dev/null || true

    # Restore any backed-up files from previous failed runs
    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
        echo "[$(date)] Restoring $(ls $BACKUP_DIR | wc -l) backed-up battlelog files..."
        mkdir -p data/battlelogs
        cp "$BACKUP_DIR"/* data/battlelogs/ 2>/dev/null || true
        # Don't delete backup yet - wait until successfully pushed
    fi

    # Pull latest changes from data-battlelogs (this will merge remote changes)
    git pull origin data-battlelogs
else
    echo "[$(date)] ⚠ Could not acquire git lock - will collect data anyway and save to backup"
fi

# NOTE: We no longer merge from main to avoid conflicts with snapshots
# Each branch now only tracks its specific files

# Run collection (this ALWAYS happens regardless of git state)
echo "[$(date)] Running battlelog collection..."
/home/ubuntu/.local/bin/uv run python collect_battlelogs.py
COLLECTION_EXIT=$?

if [ $COLLECTION_EXIT -ne 0 ]; then
    echo "[$(date)] ✗ Battlelog collection failed with exit code $COLLECTION_EXIT"
    exit 1
fi

echo "[$(date)] ✓ Battlelog collection successful"

# Only attempt git operations if we have the lock
if [ "$GIT_LOCK_ACQUIRED" = true ]; then
    # Try to commit and push (but don't fail the script if this doesn't work)
    if [[ -n $(git status -s) ]]; then
        # Only add battlelog files (not snapshots)
        git add data/battlelogs/
        if git commit -m "Battlelog update: $(TZ='Europe/Paris' date +'%A %Y-%m-%d %H:%M CET')"; then
            echo "[$(date)] Changes committed locally"

            if git push origin data-battlelogs; then
                echo "[$(date)] Pushed to data-battlelogs branch"

                # SUCCESS! Now we can safely delete backups
                if [ -d "$BACKUP_DIR" ]; then
                    rm -rf "$BACKUP_DIR"/*
                    echo "[$(date)] Cleared backup directory (data safely pushed)"
                fi

                # Try to merge to main
                git checkout main
                if git pull origin main; then
                    if git merge data-battlelogs --no-edit -m "Merge battlelog: $(TZ='Europe/Paris' date +'%A %Y-%m-%d %H:%M CET')"; then
                        if git push origin main; then
                            echo "[$(date)] ✓ Battlelog collected and merged to main"
                        else
                            echo "[$(date)] ⚠ Failed to push to main - data saved on data-battlelogs branch"
                        fi
                    else
                        # Conflicts occurred - resolve automatically
                        echo "[$(date)] Resolving conflicts: keeping battlelog files, preserving snapshot files"

                        # Accept all battlelog changes from data-battlelogs branch
                        git checkout --theirs data/battlelogs/ 2>/dev/null || true

                        # Keep main's version of snapshots (if any conflicts)
                        git checkout --ours data/snapshots/ data/latest.json data/brawlers.json 2>/dev/null || true

                        git add data/

                        if git commit --no-edit -m "Merge battlelog: $(TZ='Europe/Paris' date +'%A %Y-%m-%d %H:%M CET')"; then
                            if git push origin main; then
                                echo "[$(date)] ✓ Battlelog collected and merged to main (conflicts resolved)"
                            else
                                echo "[$(date)] ⚠ Failed to push to main - data saved on data-battlelogs branch"
                            fi
                        else
                            echo "[$(date)] ⚠ Failed to commit merge - data saved on data-battlelogs branch"
                        fi
                    fi
                else
                    echo "[$(date)] ⚠ Failed to pull main - data saved on data-battlelogs branch"
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

    # Return to data-battlelogs branch for next run
    git checkout data-battlelogs 2>/dev/null || true
else
    # NO GIT LOCK: Save data to backup directory outside of git
    echo "[$(date)] ⚠ Git operations skipped - saving data to backup directory"

    # Copy all battlelog files to backup
    mkdir -p "$BACKUP_DIR"
    cp data/battlelogs/*.json "$BACKUP_DIR/" 2>/dev/null || true

    echo "[$(date)] Data files backed up to: $BACKUP_DIR"
    echo "[$(date)] These will be committed on next successful git lock acquisition"
fi
