"""
Simplified data models for Brawl Stars daily snapshot tracking.
Python just captures raw data - all analysis happens in JavaScript.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict
from datetime import datetime


@dataclass
class BrawlerSnapshot:
    """Snapshot of a single brawler's state - only stores IDs, reference brawlers.json for details"""
    name: str
    power: int
    trophies: int
    highest_trophies: int
    rank: int
    gadget_ids: List[int] = field(default_factory=list)
    star_power_ids: List[int] = field(default_factory=list)
    hyper_charge_ids: List[int] = field(default_factory=list)
    gear_ids: List[int] = field(default_factory=list)
    prestige_level: int = 0


@dataclass
class PlayerSnapshot:
    """Daily snapshot of a player's account"""
    tag: str
    name: str
    timestamp: str

    # Trophy stats
    trophies: int
    highest_trophies: int

    # Level & victories
    exp_level: int
    victories_3v3: int = 0
    solo_victories: int = 0
    duo_victories: int = 0

    # Brawlers (full list with all details)
    brawlers: List[BrawlerSnapshot] = field(default_factory=list)


@dataclass
class ClubSnapshot:
    """Daily snapshot of entire club"""
    tag: str
    name: str
    timestamp: str

    # Club info
    type: str
    required_trophies: int
    trophies: int

    # Members (full list with all player data)
    members: List[PlayerSnapshot] = field(default_factory=list)

    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return asdict(self)


@dataclass
class DailySnapshot:
    """Top-level daily snapshot containing all tracked data"""
    date: str  # YYYY-MM-DD
    timestamp: str  # ISO 8601

    # All clubs being tracked
    clubs: List[ClubSnapshot] = field(default_factory=list)

    # Individual players (not in clubs)
    individual_players: List[PlayerSnapshot] = field(default_factory=list)

    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return asdict(self)


# Helper functions to create snapshots from API data

def create_brawler_snapshot(brawler_data: dict) -> BrawlerSnapshot:
    """Create BrawlerSnapshot from API brawler data - extracts only IDs"""
    return BrawlerSnapshot(
        name=brawler_data.get('name', ''),
        power=brawler_data.get('power', 1),
        trophies=brawler_data.get('trophies', 0),
        highest_trophies=brawler_data.get('highestTrophies', 0),
        rank=brawler_data.get('rank', 1),
        gadget_ids=[g['id'] for g in brawler_data.get('gadgets', [])],
        star_power_ids=[sp['id'] for sp in brawler_data.get('starPowers', [])],
        hyper_charge_ids=[hc['id'] for hc in brawler_data.get('hyperCharges', [])],
        gear_ids=[g['id'] for g in brawler_data.get('gears', [])],
        prestige_level=brawler_data.get('prestigeLevel', 0)
    )


def create_player_snapshot(player_data: dict) -> PlayerSnapshot:
    """Create PlayerSnapshot from API player data"""
    timestamp = datetime.utcnow().isoformat() + 'Z'

    # Create brawler snapshots
    brawler_snapshots = [
        create_brawler_snapshot(b)
        for b in player_data.get('brawlers', [])
    ]

    return PlayerSnapshot(
        tag=player_data.get('tag', ''),
        name=player_data.get('name', 'Unknown'),
        timestamp=timestamp,
        trophies=player_data.get('trophies', 0),
        highest_trophies=player_data.get('highestTrophies', 0),
        exp_level=player_data.get('expLevel', 1),
        victories_3v3=player_data.get('3vs3Victories', 0),
        solo_victories=player_data.get('soloVictories', 0),
        duo_victories=player_data.get('duoVictories', 0),
        brawlers=brawler_snapshots
    )


def create_club_snapshot(club_data: dict, member_snapshots: List[PlayerSnapshot]) -> ClubSnapshot:
    """Create ClubSnapshot from API club data and member snapshots"""
    timestamp = datetime.utcnow().isoformat() + 'Z'

    return ClubSnapshot(
        tag=club_data.get('tag', ''),
        name=club_data.get('name', 'Unknown'),
        timestamp=timestamp,
        type=club_data.get('type', 'inviteOnly'),
        required_trophies=club_data.get('requiredTrophies', 0),
        trophies=club_data.get('trophies', 0),
        members=member_snapshots
    )


def create_daily_snapshot(clubs_data: List[tuple], individual_players_data: List[dict] = None) -> DailySnapshot:
    """
    Create complete daily snapshot

    Args:
        clubs_data: List of tuples (club_data, list_of_player_data_dicts)
        individual_players_data: List of player_data dicts for individual tracking
    """
    now = datetime.utcnow()
    timestamp = now.isoformat() + 'Z'
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

    return DailySnapshot(
        date=date,
        timestamp=timestamp,
        clubs=club_snapshots,
        individual_players=individual_snapshots
    )
