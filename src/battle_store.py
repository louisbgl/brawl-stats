"""
Persistent storage for player battle logs.

Stores raw API battle items (not parsed dataclasses) so no data is ever lost
if the model changes. Files live at data/battlelogs/{TAG}.json.

Each file is a JSON list of battle items, sorted oldest → newest by battleTime.
Deduplication key: battleTime (a player can only be in one battle at a time).
"""

import json
from pathlib import Path
from src.api import api_call

STORE_DIR = Path(__file__).parent.parent / "data" / "battlelogs"


def _tag_to_filename(tag: str) -> Path:
    return STORE_DIR / f"{tag.lstrip('#')}.json"


def load_raw(tag: str) -> list:
    """Load stored battle items for a player. Returns [] if no file yet."""
    path = _tag_to_filename(tag)
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _save_raw(tag: str, items: list):
    STORE_DIR.mkdir(parents=True, exist_ok=True)
    path = _tag_to_filename(tag)
    path.write_text(json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8")


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
