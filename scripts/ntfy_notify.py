#!/usr/bin/env python3
"""
Send ntfy.sh notifications for Brawl Stats collection monitoring.

Usage:
    python ntfy_notify.py <topic> daily           # Daily report
    python ntfy_notify.py <topic> snapshot-fail   # Snapshot collection failed
    python ntfy_notify.py <topic> battlelog-fail  # Battlelog collection failed
"""

import json
import requests
from pathlib import Path
import sys

# Message templates - customize these!
MESSAGES = {
    "daily_report": {
        "template": """📊 Daily Report

Snapshot: {snapshot_status}
Battlelog: {battlelog_runs}/48 runs""",
        "priority": "low",
        "tags": ""
    },

    "snapshot_fail": {
        "template": """🚨 SNAPSHOT FAILURE

Date: {date}

Check VM logs:
tail -50 collect-snapshots.log""",
        "priority": "high",
        "tags": ""
    },

    "battlelog_fail": {
        "template": """🚨 BATTLELOG FAILURE
     
Date: {date}
Time: {time}

Check VM logs:
tail -50 collect-battlelogs.log""",
        "priority": "high",
        "tags": ""
    }
}

# ============================================================================
# Core Functions - Don't need to modify
# ============================================================================

def send_ntfy(topic, message, priority="default", tags=""):
    """Send notification via ntfy.sh."""
    try:
        response = requests.post(
            f"https://ntfy.sh/{topic}",
            data=message.encode('utf-8'),
            headers={
                "Priority": priority,
                "Tags": tags
            },
            timeout=10
        )
        response.raise_for_status()
        print(f"✓ Notification sent: {message.splitlines()[0][:50]}...")
    except Exception as e:
        print(f"✗ Failed to send notification: {e}")


def load_stats():
    """Load stats from health check file."""
    stats = {}

    # Load health check file for last 24h status
    try:
        health_path = Path('data/health.json')
        if health_path.exists():
            with open(health_path) as f:
                health = json.load(f)

            # Check last snapshot status
            last_snapshot_success = health.get('last_snapshot_success', True)

            if last_snapshot_success:
                stats['snapshot_status'] = f"✅ {health.get('last_snapshot_date', 'Unknown')}"
            else:
                stats['snapshot_status'] = f"❌ Failed"

            # Count battlelog runs in last 24h
            battlelog_runs = health.get('battlelog_runs_24h', 0)
            stats['battlelog_runs'] = battlelog_runs
        else:
            stats['snapshot_status'] = "❓ Unknown"
            stats['battlelog_runs'] = 0
    except Exception as e:
        print(f"Warning: Could not load health status: {e}")
        stats['snapshot_status'] = "❓ Unknown"
        stats['battlelog_runs'] = 0

    return stats


def send_daily_report(topic):
    """Send daily health report."""
    stats = load_stats()
    config = MESSAGES["daily_report"]

    # Determine emoji based on health status
    snapshot_ok = stats['snapshot_status'].startswith('✅')
    battlelog_ok = stats['battlelog_runs'] >= 48
    emoji = "✅" if (snapshot_ok and battlelog_ok) else "❌"

    message = config["template"].format(**stats)
    message = message.replace("📊", emoji, 1)  # Replace first emoji only
    send_ntfy(topic, message, priority=config["priority"], tags=config["tags"])


def send_snapshot_failure(topic):
    """Send snapshot collection failure alert."""
    from datetime import datetime

    config = MESSAGES["snapshot_fail"]
    date = datetime.now().strftime('%Y-%m-%d')

    message = config["template"].format(date=date)
    send_ntfy(topic, message, priority=config["priority"], tags=config["tags"])


def send_battlelog_failure(topic):
    """Send battlelog collection failure alert."""
    from datetime import datetime

    config = MESSAGES["battlelog_fail"]
    now = datetime.now()
    date = now.strftime('%Y-%m-%d')
    time = now.strftime('%H:%M:%S CET')

    message = config["template"].format(date=date, time=time)
    send_ntfy(topic, message, priority=config["priority"], tags=config["tags"])


# ============================================================================
# Main Entry Point
# ============================================================================

def main():
    """Parse arguments and send appropriate notification."""
    if len(sys.argv) < 3:
        print("Usage: ntfy_notify.py <topic> <command>")
        print("Commands: daily, snapshot-fail, battlelog-fail")
        sys.exit(1)

    topic = sys.argv[1]
    command = sys.argv[2].lower()

    if command in ['daily', 'report']:
        send_daily_report(topic)
    elif command in ['snapshot-fail', 'snapshot']:
        send_snapshot_failure(topic)
    elif command in ['battlelog-fail', 'battlelog']:
        send_battlelog_failure(topic)
    else:
        print(f"Unknown command: {command}")
        print("Valid commands: daily, snapshot-fail, battlelog-fail")
        sys.exit(1)


if __name__ == '__main__':
    main()
