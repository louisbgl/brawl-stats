"""
Health tracking for data collection monitoring.

Maintains data/health.json with collection status for monitoring/alerting.
"""

import json
import fcntl
import os
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
from contextlib import contextmanager


HEALTH_FILE = Path('data/health.json')
LOCK_FILE = Path('/tmp/brawl-health.lock')


@contextmanager
def _health_lock():
    """Acquire exclusive lock for health file operations."""
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    lock_fd = os.open(LOCK_FILE, os.O_CREAT | os.O_RDWR)

    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        os.close(lock_fd)


def _read_health() -> dict:
    """Read current health data."""
    if not HEALTH_FILE.exists():
        return {
            'last_snapshot_success': None,
            'last_snapshot_date': None,
            'last_snapshot_time': None,
            'battlelog_runs_24h': 0,
            'last_battlelog_reset': None,
            'last_updated': None
        }

    with open(HEALTH_FILE, 'r') as f:
        return json.load(f)


def _write_health(data: dict):
    """Write health data atomically."""
    HEALTH_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Atomic write: write to temp file, then rename
    temp_file = HEALTH_FILE.with_suffix('.json.tmp')

    with open(temp_file, 'w') as f:
        json.dump(data, f, indent=2)
        f.flush()
        os.fsync(f.fileno())

    temp_file.replace(HEALTH_FILE)


def update_snapshot_status(success: bool, date: str):
    """
    Update snapshot collection status and reset daily battlelog counter.

    Args:
        success: Whether snapshot collection succeeded
        date: Snapshot date in YYYY-MM-DD format
    """
    with _health_lock():
        data = _read_health()

        now = datetime.now(timezone.utc).isoformat()

        data['last_snapshot_success'] = success
        data['last_snapshot_date'] = date
        data['last_snapshot_time'] = now
        data['last_updated'] = now

        # Reset battlelog counter (snapshots run daily)
        data['battlelog_runs_24h'] = 0
        data['last_battlelog_reset'] = now

        _write_health(data)


def increment_battlelog_count():
    """Increment battlelog collection counter."""
    with _health_lock():
        data = _read_health()

        now = datetime.now(timezone.utc).isoformat()

        data['battlelog_runs_24h'] = data.get('battlelog_runs_24h', 0) + 1
        data['last_updated'] = now

        _write_health(data)


def get_health() -> dict:
    """Get current health data (for debugging/testing)."""
    return _read_health()


def reset_health():
    """Reset health file to initial state (for testing)."""
    if HEALTH_FILE.exists():
        HEALTH_FILE.unlink()
