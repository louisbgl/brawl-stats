#!/usr/bin/env python3
"""
Hourly battle log collection script.

Fetches battle logs for all tracked players and stores them in data/battlelogs/.
Designed to run every hour to catch all battles before the API's 25-entry limit rotates.
"""

from datetime import datetime
from zoneinfo import ZoneInfo
from src.config import get_all_tracked_player_tags
from src.battle_store import update, write_metadata


def main():
    print("=" * 60)
    print("BATTLE LOG COLLECTION")
    print("=" * 60)
    print(f"Timestamp: {datetime.now(ZoneInfo('Europe/Paris')).isoformat()}")
    print()

    # Get all tracked players
    print("Fetching tracked player list...")
    try:
        players = get_all_tracked_player_tags()
        print(f"  ✓ Found {len(players)} players to update")
    except Exception as e:
        print(f"  ✗ Error getting player list: {e}")
        return
    print()

    # Update battle logs for each player
    print("Updating battle logs:")
    total_new = 0
    total_stored = 0
    success_count = 0
    fail_count = 0

    for i, (tag, name) in enumerate(players, 1):
        print(f"  [{i}/{len(players)}] {name} ({tag})...", end=" ")
        try:
            new_count, total_count = update(tag, name)
            total_new += new_count
            total_stored += total_count
            success_count += 1

            if new_count > 0:
                print(f"✓ +{new_count} new (total: {total_count})")
            else:
                print(f"✓ no new battles (total: {total_count})")
        except Exception as e:
            fail_count += 1
            print(f"✗ Error: {e}")

    # Write metadata file (always updates to ensure commit)
    write_metadata(len(players), total_new)

    print()
    print("=" * 60)
    print("COLLECTION COMPLETE")
    print("=" * 60)
    print(f"Players updated: {success_count}/{len(players)}")
    if fail_count > 0:
        print(f"Failed: {fail_count}")
    print(f"New battles collected: {total_new}")
    print(f"Total battles stored: {total_stored}")
    print("=" * 60)


if __name__ == "__main__":
    main()
