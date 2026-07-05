#!/bin/bash

export PATH="$HOME/.local/bin:$PATH"
cd /home/ubuntu/brawl-stats

# Load environment variables (for NTFY_TOPIC)
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

echo "[$(date)] Sending daily health report..."

if [ -z "$NTFY_TOPIC" ]; then
    echo "[$(date)] ✗ NTFY_TOPIC not set in .env"
    exit 1
fi

python scripts/ntfy_notify.py "$NTFY_TOPIC" daily

echo "[$(date)] ✓ Daily report sent"
