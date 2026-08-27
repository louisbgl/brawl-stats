"""
Battle aggregation with flat player-centric format.

Generates 7-day battle segments with deduplicated and merged tracked player data.
"""

from pathlib import Path
from typing import Dict, List, Set
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from .battle_flattening import normalize_battle_to_players, merge_tracked_player_data


def generate_battle_segments(
    raw_dir: Path,
    agg_dir: Path,
    player_index: Dict,
    battlelog_loader
):
    """
    Generate deduplicated 7-day battle segments with flat player structure.

    Args:
        raw_dir: Path to raw data directory
        agg_dir: Path to aggregated output directory
        player_index: Dict of {tag: {name}} for tracked players
        battlelog_loader: Function to load battlelog for a player tag

    Outputs:
        data/aggregated/battles/recent.json (last 7 days)
        data/aggregated/battles/week-2.json (8-14 days ago)
        data/aggregated/battles/week-3.json (15-21 days ago)
        data/aggregated/battles/week-4.json (22-28 days ago)
        data/aggregated/battles/older.json (29+ days ago)
    """
    print("\nGenerating battle segments...")

    tracked_tags = set(player_index.keys())

    # Collect all battles from all tracked players
    battles_by_key = {}  # (battleTime, mode) -> battle dict

    for tag in tracked_tags:
        battles = battlelog_loader(tag)

        print(f"  Processing {len(battles)} battles from {player_index[tag]['name']}...")

        for battle_raw in battles:
            battle_time = battle_raw.get("battleTime")
            mode = battle_raw.get("event", {}).get("mode", "unknown")
            map_name = battle_raw.get("event", {}).get("map", "Unknown")
            battle_type = battle_raw.get("battle", {}).get("type")

            if not battle_time or not mode:
                continue

            # Dedup key
            key = (battle_time, mode)

            # Convert to flat player structure
            players = normalize_battle_to_players(battle_raw, tag, tracked_tags)

            if not players:
                continue  # Skip empty battles

            if key in battles_by_key:
                # Battle already exists - merge tracked player data
                merge_tracked_player_data(battles_by_key[key], players, tag)
            else:
                # New battle
                battles_by_key[key] = {
                    "battleTime": battle_time,
                    "mode": mode,
                    "map": map_name,
                    "type": battle_type,
                    "duration": battle_raw.get("battle", {}).get("duration"),
                    "players": players
                }

    # Filter to only battles with at least one tracked player
    battles_with_tracked = {}
    for key, battle in battles_by_key.items():
        has_tracked = any(p['trophyChange'] is not None for p in battle['players'])
        if has_tracked:
            battles_with_tracked[key] = battle

    print(f"  Total battles after dedup: {len(battles_with_tracked)}")

    # Sort by time descending (newest first)
    all_battles = sorted(
        battles_with_tracked.values(),
        key=lambda b: b["battleTime"],
        reverse=True
    )

    # Segment into 7-day buckets
    now = datetime.now(timezone.utc)
    segments = {
        'recent': [],  # Last 7 days
        'week2': [],   # 8-14 days ago
        'week3': [],   # 15-21 days ago
        'week4': [],   # 22-28 days ago
        'older': []    # 29+ days ago
    }

    for battle in all_battles:
        battle_time_str = battle.get('battleTime', '')
        try:
            # Parse API timestamp: "20260826T134521.000Z"
            battle_time = datetime.strptime(battle_time_str, '%Y%m%dT%H%M%S.%fZ').replace(tzinfo=timezone.utc)
            days_ago = (now - battle_time).days

            if days_ago < 7:
                segments['recent'].append(battle)
            elif days_ago < 14:
                segments['week2'].append(battle)
            elif days_ago < 21:
                segments['week3'].append(battle)
            elif days_ago < 28:
                segments['week4'].append(battle)
            else:
                segments['older'].append(battle)
        except:
            # If parsing fails, put in older
            segments['older'].append(battle)

    # Save segments with predictable filenames
    battles_dir = agg_dir / "battles"
    battles_dir.mkdir(parents=True, exist_ok=True)

    import json

    def save_segment(name, data):
        filepath = battles_dir / f"{name}.json"
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        size_kb = filepath.stat().st_size / 1024
        print(f"   {name}.json: {len(data)} battles ({size_kb:.1f} KB)")

    save_segment('recent', segments['recent'])

    if segments['week2']:
        save_segment('week-2', segments['week2'])

    if segments['week3']:
        save_segment('week-3', segments['week3'])

    if segments['week4']:
        save_segment('week-4', segments['week4'])

    if segments['older']:
        save_segment('older', segments['older'])

    return True
