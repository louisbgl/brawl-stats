#!/usr/bin/env python3
"""
Test trophy timeline algorithm to debug chart issues.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

def parse_iso_date(date_str):
    """Parse ISO date string to datetime."""
    # Handle both with and without timezone
    if date_str.endswith('Z'):
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    return datetime.fromisoformat(date_str)

def convert_battle_time(battle_time_str):
    """Convert battle time format 20260324T161433.000Z to ISO."""
    # Format: YYYYMMDDTHHMMSS.000Z
    return battle_time_str[:4] + '-' + battle_time_str[4:6] + '-' + battle_time_str[6:8] + 'T' + \
           battle_time_str[9:11] + ':' + battle_time_str[11:13] + ':' + battle_time_str[13:15] + '.000Z'

def load_data(player_tag):
    """Load snapshot and battle data for a player."""
    # Load snapshots
    data_dir = Path('data')
    snapshots = []

    for snapshot_file in sorted(data_dir.glob('2026-*.json')):
        with open(snapshot_file) as f:
            snapshot = json.load(f)

        # Find player in snapshot
        for club in snapshot.get('clubs', []):
            for member in club.get('members', []):
                if member['tag'] == player_tag:
                    snapshots.append({
                        'date': snapshot['date'],
                        'timestamp': snapshot['timestamp'],
                        'trophies': member['trophies']
                    })
                    break

    # Load battles
    battlelog_file = data_dir / 'battlelogs' / f'{player_tag[1:]}.json'
    battles = []

    if battlelog_file.exists():
        with open(battlelog_file) as f:
            battle_data = json.load(f)

        for battle in battle_data:
            iso_time = convert_battle_time(battle['battleTime'])
            battles.append({
                'timestamp': iso_time,
                'trophy_change': battle['battle'].get('trophyChange', 0)
            })

    return snapshots, battles

def calculate_timeline(snapshots, battles, current_trophies):
    """Calculate trophy timeline with snapshots as anchors and battles for granularity.

    Key insight: Snapshots are the source of truth. Battle data provides granularity
    but may be incomplete (API only returns last 25 battles). We use snapshots as
    anchor points and add battle detail where available.
    """

    print(f"Current trophies: {current_trophies}")
    print(f"Total battles: {len(battles)}")
    print(f"Total snapshots: {len(snapshots)}\n")

    # Create a list of snapshots with timestamps
    all_snapshots = []
    for snap in snapshots:
        all_snapshots.append({
            'timestamp': parse_iso_date(snap['timestamp']),
            'trophies': snap['trophies'],
            'date': snap['date']
        })

    all_snapshots.sort(key=lambda s: s['timestamp'])

    # Convert battles to list with parsed timestamps
    all_battles = []
    for battle in battles:
        all_battles.append({
            'timestamp': parse_iso_date(battle['timestamp']),
            'trophy_change': battle['trophy_change']
        })

    all_battles.sort(key=lambda b: b['timestamp'])

    # Build timeline points
    points = []

    # Add all snapshot points first
    for snapshot in all_snapshots:
        points.append({
            'timestamp': snapshot['timestamp'],
            'date_str': snapshot['date'],
            'trophies': snapshot['trophies'],
            'source': 'snapshot'
        })

    # Now add battle points, but only for battles AFTER the last snapshot
    # (earlier battles are incomplete/missing so we can't trust the calculated values)
    if all_snapshots:
        last_snapshot = all_snapshots[-1]
        last_snapshot_time = last_snapshot['timestamp']
        last_snapshot_trophies = last_snapshot['trophies']

        # Filter battles after last snapshot
        battles_after_snapshot = [b for b in all_battles if b['timestamp'] > last_snapshot_time]

        # Calculate trophy progression from last snapshot
        current_trophy = last_snapshot_trophies
        for battle in battles_after_snapshot:
            current_trophy += battle['trophy_change']
            points.append({
                'timestamp': battle['timestamp'],
                'date_str': battle['timestamp'].isoformat(),
                'trophies': current_trophy,
                'source': 'battle'
            })

    # Sort all points chronologically
    points.sort(key=lambda p: p['timestamp'])

    print(f"Added {len([p for p in points if p['source'] == 'battle'])} battle points after last snapshot\n")

    return points

def main():
    player_tag = '#LLJGJQVY'  # Escorte

    snapshots, battles = load_data(player_tag)

    # Get current trophies from latest.json
    with open('data/latest.json') as f:
        latest = json.load(f)

    current_trophies = None
    for club in latest.get('clubs', []):
        for member in club.get('members', []):
            if member['tag'] == player_tag:
                current_trophies = member['trophies']
                break

    if current_trophies is None:
        print(f"Player {player_tag} not found")
        return

    points = calculate_timeline(snapshots, battles, current_trophies)

    print(f"\n{'='*80}")
    print(f"Total timeline points: {len(points)}")
    print(f"{'='*80}\n")

    # Print all points
    for i, point in enumerate(points):
        source_label = 'SNAPSHOT' if point['source'] == 'snapshot' else 'battle  '
        date_display = point['date_str'][:19] if point['source'] == 'battle' else point['date_str']
        print(f"{i:3d}: {source_label} | {date_display} | {point['trophies']} trophies")

    # Check for anomalies
    print(f"\n{'='*80}")
    print("Checking for big trophy jumps (>200):")
    print(f"{'='*80}\n")

    for i in range(1, len(points)):
        diff = points[i]['trophies'] - points[i-1]['trophies']
        if abs(diff) > 200:
            prev = points[i-1]
            curr = points[i]
            prev_label = 'SNAPSHOT' if prev['source'] == 'snapshot' else 'battle  '
            curr_label = 'SNAPSHOT' if curr['source'] == 'snapshot' else 'battle  '
            prev_date = prev['date_str'][:19] if prev['source'] == 'battle' else prev['date_str']
            curr_date = curr['date_str'][:19] if curr['source'] == 'battle' else curr['date_str']

            print(f"[{i-1}→{i}] {prev_label} {prev_date} ({prev['trophies']}) -> "
                  f"{curr_label} {curr_date} ({curr['trophies']}) = {diff:+d}")

if __name__ == '__main__':
    main()
