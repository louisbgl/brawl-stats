#!/bin/bash

export PATH="$HOME/.local/bin:$PATH"
cd /home/ubuntu/brawl-stats

echo "[$(date)] Starting daily snapshot collection..."

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

    # Clean up any previous merge state and uncommitted changes
    git merge --abort 2>/dev/null || true
    git reset --hard HEAD
    git clean -fd

    # Pull latest changes from data-snapshots
    git pull origin data-snapshots
else
    echo "[$(date)] ⚠ Could not acquire git lock - will collect data anyway and save locally"
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

            # Try to merge to main
            # First, make sure we have a clean state
            git reset --hard HEAD
            git clean -fd

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

                    if git commit --no-edit -m "Merge daily snapshot: $(TZ='Europe/Paris' date +'%Y-%m-%d')"; then
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

    # Always return to data-snapshots branch for next run with clean state
    git checkout data-snapshots 2>/dev/null || true
    git reset --hard HEAD 2>/dev/null || true
    git clean -fd 2>/dev/null || true
else
    echo "[$(date)] ⚠ Git operations skipped - data saved locally. Manual push required."
    echo "[$(date)] Data files: data/snapshots/$(TZ='Europe/Paris' date +'%Y-%m-%d').json, data/latest.json"
fi
