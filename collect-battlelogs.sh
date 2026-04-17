#!/bin/bash

export PATH="$HOME/.local/bin:$PATH"
cd /home/ubuntu/brawl-stats

# Lock file to prevent concurrent execution with snapshot collection
LOCKFILE="/tmp/brawl-stats-git.lock"
LOCKFD=200

# Try to acquire lock with timeout
exec 200>"$LOCKFILE"
if ! flock -w 300 200; then
    echo "[$(date)] ✗ Could not acquire lock after 5 minutes - another collection is running"
    exit 1
fi

echo "[$(date)] Starting battlelog collection..."

# Checkout data-battlelogs branch
git fetch origin
git checkout data-battlelogs

# Clean up any previous merge state and uncommitted changes
git merge --abort 2>/dev/null || true
git reset --hard HEAD
git clean -fd

# Pull latest changes from data-battlelogs
git pull origin data-battlelogs

# NOTE: We no longer merge from main to avoid conflicts with snapshots
# Each branch now only tracks its specific files

# Run collection (this always happens regardless of git state)
echo "[$(date)] Running battlelog collection..."
/home/ubuntu/.local/bin/uv run python collect_battlelogs.py
COLLECTION_EXIT=$?

if [ $COLLECTION_EXIT -ne 0 ]; then
    echo "[$(date)] ✗ Battlelog collection failed with exit code $COLLECTION_EXIT"
    exit 1
fi

echo "[$(date)] ✓ Battlelog collection successful"

# Try to commit and push (but don't fail the script if this doesn't work)
if [[ -n $(git status -s) ]]; then
    # Only add battlelog files (not snapshots)
    git add data/battlelogs/
    if git commit -m "Battlelog update: $(TZ='Europe/Paris' date +'%A %Y-%m-%d %H:%M CET')"; then
        echo "[$(date)] Changes committed locally"

        if git push origin data-battlelogs; then
            echo "[$(date)] Pushed to data-battlelogs branch"

            # Try to merge to main
            # First, make sure we have a clean state
            git reset --hard HEAD
            git clean -fd

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

# Always return to data-battlelogs branch for next run with clean state
git checkout data-battlelogs 2>/dev/null || true
git reset --hard HEAD 2>/dev/null || true
git clean -fd 2>/dev/null || true
