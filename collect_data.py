#!/usr/bin/env python3
"""
Main script to collect daily Brawl Stars data snapshots.
Fetches data from API and saves to JSON files in data/ folder.
"""

import json
import os
from datetime import datetime
from zoneinfo import ZoneInfo
from src.config import CLUBS, INDIVIDUAL_PLAYERS
from src.api import fetch_club_data, fetch_player_data, get_club_members_tags, fetch_brawlers_reference
from src.models import create_daily_snapshot


def main():
    print("=" * 60)
    print("BRAWL STARS DATA COLLECTION")
    print("=" * 60)
    print(f"Timestamp: {datetime.now(ZoneInfo('Europe/Paris')).isoformat()}")
    print()

    # Fetch and save brawlers reference data
    print("Fetching brawlers reference data...")
    try:
        brawlers_ref = fetch_brawlers_reference()
        output_dir = "data"
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

    # Save to file
    date_str = daily_snapshot.date
    output_dir = "data"
    snapshots_dir = os.path.join(output_dir, "snapshots")
    os.makedirs(snapshots_dir, exist_ok=True)

    output_file = os.path.join(snapshots_dir, f"{date_str}.json")
    latest_file = os.path.join(output_dir, "latest.json")

    snapshot_dict = daily_snapshot.to_dict()

    # Check if file already exists
    file_existed = os.path.exists(output_file)
    action = "Updated" if file_existed else "Created"

    # Write dated file (overwrites if exists)
    with open(output_file, 'w') as f:
        json.dump(snapshot_dict, f, indent=2)

    # Write/update latest.json (always overwrites)
    with open(latest_file, 'w') as f:
        json.dump(snapshot_dict, f, indent=2)

    # Calculate file size
    file_size_kb = os.path.getsize(output_file) / 1024

    print()
    print("=" * 60)
    print("COLLECTION COMPLETE")
    print("=" * 60)
    print(f"Date: {date_str}")
    print(f"Clubs tracked: {len(daily_snapshot.clubs)}")
    print(f"Individual players: {len(daily_snapshot.individual_players)}")

    total_players = sum(len(club.members) for club in daily_snapshot.clubs) + len(daily_snapshot.individual_players)
    print(f"Total players: {total_players}")
    print()
    print(f"{action}: {output_file}")
    print(f"Updated: {latest_file}")
    print(f"File size: {file_size_kb:.1f} KB")
    if file_existed:
        print(f"Note: Existing data for {date_str} was overwritten with fresh data")
    print("=" * 60)


if __name__ == "__main__":
    main()
