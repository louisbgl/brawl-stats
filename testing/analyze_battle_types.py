#!/usr/bin/env python3
"""Analyze battle types from the past 2 weeks of battle logs."""

import json
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import defaultdict

# Load all battle logs
battlelog_dir = Path("data/battlelogs")
cutoff_date = datetime.now(timezone.utc) - timedelta(weeks=2)

print(f"Analyzing battles from {cutoff_date.isoformat()} onwards...\n")

# Track unique battle types and modes
battle_types = defaultdict(int)  # type -> count
battle_modes = defaultdict(int)  # mode -> count
type_mode_combos = defaultdict(int)  # (type, mode) -> count

total_battles = 0

for battlelog_file in battlelog_dir.glob("*.json"):
    if battlelog_file.name.startswith("_"):
        continue

    with open(battlelog_file) as f:
        battles = json.load(f)

    for battle in battles:
        # Parse battle time
        battle_time = datetime.strptime(battle["battleTime"], "%Y%m%dT%H%M%S.%fZ").replace(tzinfo=timezone.utc)

        if battle_time < cutoff_date:
            continue

        total_battles += 1

        battle_data = battle["battle"]
        event_data = battle["event"]

        battle_type = battle_data.get("type", "null")
        battle_mode = battle_data.get("mode") or event_data.get("mode", "unknown")

        battle_types[battle_type] += 1
        battle_modes[battle_mode] += 1
        type_mode_combos[(battle_type, battle_mode)] += 1

print(f"Total battles analyzed: {total_battles}\n")

print("=" * 60)
print("BATTLE TYPES:")
print("=" * 60)
for battle_type, count in sorted(battle_types.items(), key=lambda x: -x[1]):
    print(f"  {battle_type:20s} - {count:5d} battles")

print("\n" + "=" * 60)
print("BATTLE MODES:")
print("=" * 60)
for battle_mode, count in sorted(battle_modes.items(), key=lambda x: -x[1]):
    print(f"  {battle_mode:20s} - {count:5d} battles")

print("\n" + "=" * 60)
print("TYPE + MODE COMBINATIONS:")
print("=" * 60)
for (battle_type, battle_mode), count in sorted(type_mode_combos.items(), key=lambda x: -x[1]):
    print(f"  {battle_type:20s} + {battle_mode:20s} - {count:5d} battles")

# Now let's check which types/modes we know about
print("\n" + "=" * 60)
print("KNOWN vs UNKNOWN:")
print("=" * 60)

known_modes = {
    "brawlBall", "gemGrab", "bounty", "knockout", "hotZone",
    "siege", "duoShowdown", "soloShowdown"
}

print("\nKNOWN MODES (from battle_models.py):")
for mode in sorted(known_modes):
    if mode in battle_modes:
        print(f"  ✓ {mode:20s} - {battle_modes[mode]:5d} battles")
    else:
        print(f"  - {mode:20s} - not seen in past 2 weeks")

print("\nUNKNOWN MODES (not documented in battle_models.py):")
unknown_modes = set(battle_modes.keys()) - known_modes
if unknown_modes:
    for mode in sorted(unknown_modes):
        print(f"  ? {mode:20s} - {battle_modes[mode]:5d} battles")
else:
    print("  (none)")

print("\nBATTLE TYPES:")
known_types = {"ranked", "friendly", "soloRanked"}
print("\nKNOWN TYPES (mentioned in battle_models.py):")
for battle_type in sorted(known_types):
    if battle_type in battle_types:
        print(f"  ✓ {battle_type:20s} - {battle_types[battle_type]:5d} battles")
    else:
        print(f"  - {battle_type:20s} - not seen in past 2 weeks")

print("\nUNKNOWN TYPES (not documented in battle_models.py):")
unknown_types = set(battle_types.keys()) - known_types
if unknown_types:
    for battle_type in sorted(unknown_types):
        print(f"  ? {battle_type:20s} - {battle_types[battle_type]:5d} battles")
else:
    print("  (none)")
