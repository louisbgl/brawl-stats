"""
Data models for battle log tracking.
Mirrors the structure discovered via keys() analysis on the API response.

Battle types observed:
  - Team modes (brawlBall, gemGrab, bounty, knockout, hotZone, siege, duoShowdown):
      always have: result ("victory"/"defeat"), teams, duration, starPlayer
      sometimes have: trophyChange (not in friendlies)
  - Solo showdown (soloShowdown):
      always have: rank, players
      never have: result, teams, duration, starPlayer, trophyChange

won inference: trophy_change > 0 → True, < 0 → False, == 0 → None (friendly/undetermined)
"""

from dataclasses import dataclass, field, asdict
from typing import List, Optional
from datetime import datetime, timezone


@dataclass
class BattleBrawler:
    name: str
    power: int
    trophies: int


@dataclass
class BattlePlayer:
    tag: str
    name: str
    brawler: BattleBrawler


@dataclass
class BattleEntry:
    # Timing
    battle_time: str        # raw API string e.g. "20260325T005836.000Z"

    # Event info
    event_id: int
    event_mode: str         # e.g. "brawlBall", "soloShowdown"
    event_map: str

    # Battle info (always present)
    mode: str               # same as event_mode (redundant but kept for raw fidelity)
    type: str               # "ranked", "friendly", "soloRanked" ...

    # Team mode fields (None in soloShowdown)
    result: Optional[str]               # "victory" or "defeat"
    duration: Optional[int]             # seconds
    star_player: Optional[BattlePlayer]
    teams: List[List[BattlePlayer]] = field(default_factory=list)

    # Solo showdown fields (None in team modes)
    rank: Optional[int] = None
    players: List[BattlePlayer] = field(default_factory=list)

    # Always optional
    trophy_change: int = 0              # 0 when absent (friendlies, etc.)

    # Inferred
    won: Optional[bool] = None          # None when undetermined (e.g. friendly)

    def timestamp(self) -> datetime:
        """Parse battle_time into a UTC datetime."""
        return datetime.strptime(self.battle_time, "%Y%m%dT%H%M%S.%fZ").replace(tzinfo=timezone.utc)


@dataclass
class PlayerBattleLog:
    tag: str
    name: str
    fetched_at: str         # ISO 8601
    battles: List[BattleEntry] = field(default_factory=list)

    def wins(self) -> List[BattleEntry]:
        return [b for b in self.battles if b.won is True]

    def losses(self) -> List[BattleEntry]:
        return [b for b in self.battles if b.won is False]


# ── factory functions ─────────────────────────────────────────────────────────

def _parse_brawler(data: dict) -> BattleBrawler:
    return BattleBrawler(
        name=data["name"],
        power=data["power"],
        trophies=data.get("trophies", 0),
    )

def _parse_player(data: dict) -> BattlePlayer:
    return BattlePlayer(
        tag=data["tag"],
        name=data["name"],
        brawler=_parse_brawler(data["brawler"]),
    )

def _infer_won(trophy_change: int) -> Optional[bool]:
    if trophy_change > 0:
        return True
    if trophy_change < 0:
        return False
    return None  # 0 = friendly or undetermined

def parse_battle_entry(raw: dict) -> BattleEntry:
    event = raw["event"]
    b     = raw["battle"]

    result       = b.get("result")
    rank         = b.get("rank")
    star_raw     = b.get("starPlayer")
    teams_raw    = b.get("teams", [])
    players_raw  = b.get("players", [])
    tc           = b.get("trophyChange")

    return BattleEntry(
        battle_time  = raw["battleTime"],
        event_id     = event["id"],
        event_mode   = event["mode"],
        event_map    = event["map"],
        mode         = b["mode"],
        type         = b["type"],
        result       = result,
        duration     = b.get("duration"),
        star_player  = _parse_player(star_raw) if star_raw else None,
        teams        = [[_parse_player(p) for p in team] for team in teams_raw],
        rank         = rank,
        players      = [_parse_player(p) for p in players_raw],
        trophy_change= tc or 0,
        won          = _infer_won(tc or 0),
    )

def parse_player_battle_log(player_tag: str, player_name: str, api_response: dict) -> PlayerBattleLog:
    from datetime import datetime, timezone
    battles = [parse_battle_entry(item) for item in api_response.get("items", [])]
    return PlayerBattleLog(
        tag        = player_tag,
        name       = player_name,
        fetched_at = datetime.now(timezone.utc).isoformat(),
        battles    = battles,
    )
