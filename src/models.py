"""
Data models for Brawl Stars daily snapshot tracking.

Strategy: Store raw API responses with minimal additions (timestamp only).
All field normalization happens in JavaScript.
"""

from typing import List
from datetime import datetime
from zoneinfo import ZoneInfo


def create_brawler_snapshot(brawler_data: dict) -> dict:
    """Store raw API brawler data as-is."""
    return brawler_data


def create_player_snapshot(player_data: dict) -> dict:
    """Store raw API player data + add timestamp."""
    return {
        **player_data,
        'timestamp': datetime.now(ZoneInfo("Europe/Paris")).isoformat(),
    }


def create_club_snapshot(club_data: dict, member_snapshots: List[dict]) -> dict:
    """Store raw API club data + add timestamp + processed members."""
    return {
        **club_data,
        'timestamp': datetime.now(ZoneInfo("Europe/Paris")).isoformat(),
        'members': member_snapshots,
    }


def create_daily_snapshot(clubs_data: List[tuple], individual_players_data: List[dict] = None) -> dict:
    """
    Create complete daily snapshot.

    Args:
        clubs_data: List of tuples (club_data, list_of_player_data_dicts)
        individual_players_data: List of player_data dicts for individual tracking

    Returns:
        Dictionary ready for JSON serialization with all API data preserved.
    """
    now = datetime.now(ZoneInfo("Europe/Paris"))
    timestamp = now.isoformat()
    date = now.strftime('%Y-%m-%d')

    # Create club snapshots
    club_snapshots = []
    for club_data, members_data in clubs_data:
        member_snapshots = [create_player_snapshot(p) for p in members_data]
        club_snapshots.append(create_club_snapshot(club_data, member_snapshots))

    # Create individual player snapshots
    individual_snapshots = []
    if individual_players_data:
        individual_snapshots = [create_player_snapshot(p) for p in individual_players_data]

    return {
        'date': date,
        'timestamp': timestamp,
        'clubs': club_snapshots,
        'individual_players': individual_snapshots,
    }
