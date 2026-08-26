"""
V2 persistent storage for player battle logs with compression.

Stores raw API battle items as compressed .json.gz files.
Files live at data/raw/battlelogs/{TAG}.json.gz.

Each file is a JSON list of battle items, sorted oldest → newest by battleTime.
Deduplication key: battleTime (a player can only be in one battle at a time).
"""

import json
from pathlib import Path
from datetime import datetime, timezone
from src.collection.api import api_call
from src.aggregation.compression import save_compressed, load_compressed

STORE_DIR = Path(__file__).parent.parent.parent / "data" / "raw" / "battlelogs"
METADATA_DIR = Path(__file__).parent.parent.parent / "data" / "raw" / "metadata"
METADATA_FILE = METADATA_DIR / "battlelogs.json"


def _tag_to_filename(tag: str) -> Path:
    """Convert player tag to compressed battlelog filename."""
    return STORE_DIR / f"{tag.lstrip('#')}.json.gz"


def load_raw(tag: str) -> list:
    """Load stored battle items for a player. Returns [] if no file yet."""
    path = _tag_to_filename(tag)
    if not path.exists():
        return []
    return load_compressed(path)


def _save_raw(tag: str, items: list):
    """Save battle items as compressed file."""
    STORE_DIR.mkdir(parents=True, exist_ok=True)
    path = _tag_to_filename(tag)
    save_compressed(items, path)


def update(tag: str, name: str = "") -> tuple[int, int]:
    """
    Fetch latest battle log from API, persist new battles to disk.

    Returns (new_count, total_count).
    """
    response = api_call(f"players/{tag.replace('#', '%23')}/battlelog")
    fetched  = response.json().get("items", [])

    existing      = load_raw(tag)
    known_times   = {b["battleTime"] for b in existing}
    new_items     = [b for b in fetched if b["battleTime"] not in known_times]

    if new_items:
        merged = existing + new_items
        merged.sort(key=lambda b: b["battleTime"])
        _save_raw(tag, merged)

    return len(new_items), len(existing) + len(new_items)


def write_metadata(total_players: int, total_new_battles: int):
    """
    Write metadata file with timestamp of last collection run.
    This file is always updated to ensure git commits happen every run.
    """
    METADATA_DIR.mkdir(parents=True, exist_ok=True)
    metadata = {
        "last_collection": datetime.now(timezone.utc).isoformat(),
        "players_checked": total_players,
        "new_battles": total_new_battles
    }
    METADATA_FILE.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")
