#!/usr/bin/env python3
"""
V2 snapshot collection script with compression.

Fetches daily Brawl Stars data and saves as compressed .json.gz files.
This is the v2 variant - DO NOT deploy to VM until v2 merge complete.
"""

import json
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo
from src.config import CLUBS, INDIVIDUAL_PLAYERS
from src.api import fetch_club_data, fetch_player_data, get_club_members_tags, fetch_brawlers_reference
from src.models import create_daily_snapshot
from src.health import update_snapshot_status
from src.aggregation.compression import save_compressed, get_compressed_size, get_compression_ratio


def main():
    print("=" * 60)
    print("BRAWL STARS DATA COLLECTION (V2 - COMPRESSED)")
    print("=" * 60)
    print(f"Timestamp: {datetime.now(ZoneInfo('Europe/Paris')).isoformat()}")
    print()

    # Fetch and save brawlers reference data (uncompressed, small file)
    print("Fetching brawlers reference data...")
    try:
        brawlers_ref = fetch_brawlers_reference()
        output_dir = "data/raw/metadata"
        os.makedirs(output_dir, exist_ok=True)

        brawlers_file = os.path.join(output_dir, "brawlers.json")
        with open(brawlers_file, 'w') as f:
            json.dump(brawlers_ref, f, indent=2)

        print(f"  ✓ Saved {len(brawlers_ref.get('items', []))} brawlers to {brawlers_file}")
    except Exception as e:
        print(f"  ✗ Error fetching brawlers: {e}")
    print()

    # Collect club data
    clubs_data = []

    for club_config in CLUBS:
        club_tag = club_config['tag']
        club_name = club_config['name']

        print(f"Fetching club: {club_name} ({club_tag})")
        try:
            club_data = fetch_club_data(club_tag)
            member_tags = get_club_members_tags(club_data)
            print(f"  Members: {len(member_tags)}")

            # Fetch all member data
            members_data = []
            for i, tag in enumerate(member_tags, 1):
                print(f"  [{i}/{len(member_tags)}] {tag}...", end=" ")
                try:
                    player_data = fetch_player_data(tag)
                    members_data.append(player_data)
                    print(f"✓ {player_data.get('name')}")
                except Exception as e:
                    print(f"✗ Error: {e}")

            clubs_data.append((club_data, members_data))
            print()

        except Exception as e:
            print(f"  ✗ Error fetching club: {e}")
            print()

    # Collect individual player data
    individual_data = []

    if INDIVIDUAL_PLAYERS:
        print("Fetching individual players:")
        for player_config in INDIVIDUAL_PLAYERS:
            tag = player_config['tag']
            name = player_config['name']
            print(f"  {name} ({tag})...", end=" ")
            try:
                player_data = fetch_player_data(tag)
                individual_data.append(player_data)
                print(f"✓")
            except Exception as e:
                print(f"✗ Error: {e}")
        print()

    # Create daily snapshot
    print("Creating daily snapshot...")
    daily_snapshot = create_daily_snapshot(clubs_data, individual_data if individual_data else None)

    # Save to compressed file
    date_str = daily_snapshot['date']
    snapshots_dir = "data/raw/snapshots"
    metadata_dir = "data/raw/metadata"
    os.makedirs(snapshots_dir, exist_ok=True)
    os.makedirs(metadata_dir, exist_ok=True)

    output_file = os.path.join(snapshots_dir, f"{date_str}.json.gz")
    latest_file = os.path.join(metadata_dir, "latest.json")

    snapshot_dict = daily_snapshot

    # Check if file already exists
    file_existed = os.path.exists(output_file)
    action = "Updated" if file_existed else "Created"

    # Calculate uncompressed size (for comparison)
    uncompressed_json = json.dumps(snapshot_dict, separators=(',', ':')).encode('utf-8')
    uncompressed_size = len(uncompressed_json)

    # Write compressed dated file (overwrites if exists)
    save_compressed(snapshot_dict, output_file)

    # Write metadata file (timestamp of collection)
    metadata_file = os.path.join(metadata_dir, "snapshots.json")
    metadata = {
        "last_collection": datetime.now(ZoneInfo('UTC')).isoformat(),
        "timestamp": snapshot_dict['timestamp'],
        "date": date_str,
        "total_players": sum(len(club['members']) for club in daily_snapshot['clubs']) + len(daily_snapshot['individual_players'])
    }
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2)

    # Calculate compression stats
    compressed_size = get_compressed_size(output_file)
    compression_ratio = get_compression_ratio(uncompressed_size, compressed_size)

    print()
    print("=" * 60)
    print("COLLECTION COMPLETE (V2 - COMPRESSED)")
    print("=" * 60)
    print(f"Date: {date_str}")
    print(f"Clubs tracked: {len(daily_snapshot['clubs'])}")
    print(f"Individual players: {len(daily_snapshot['individual_players'])}")

    total_players = sum(len(club['members']) for club in daily_snapshot['clubs']) + len(daily_snapshot['individual_players'])
    print(f"Total players: {total_players}")
    print()
    print(f"{action}: {output_file}")
    print(f"Updated: {latest_file}")
    print(f"Uncompressed size: {uncompressed_size / 1024:.1f} KB")
    print(f"Compressed size: {compressed_size / 1024:.1f} KB")
    print(f"Compression ratio: {compression_ratio * 100:.1f}% reduction")
    if file_existed:
        print(f"Note: Existing data for {date_str} was overwritten with fresh data")
    print("=" * 60)

    # Update health status
    update_snapshot_status(success=True, date=date_str)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # Try to get date for health update (may not be set if early failure)
        try:
            from datetime import date
            date_str = date.today().isoformat()
            update_snapshot_status(success=False, date=date_str)
        except:
            pass
        print(f"\nERROR: {e}", file=sys.stderr)
        sys.exit(1)
