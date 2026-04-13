"""
Data models for battle log tracking.
Mirrors the structure discovered via keys() analysis on the API response.

=== BATTLE TYPES (battle.type) ===
  - ranked: Ladder/Trophy system (normal matchmaking with trophy changes, brawlers at various trophy levels)
  - soloRanked: Competitive Ranked system (ELO-based matchmaking, no trophy changes, brawlers at low trophy levels 1-16)
  - friendly: Friendly matches (no trophy changes, casual play)
  - null (no type field): Special events and PvE modes (e.g., lastStand)

=== ALL EVENT MODES (event.mode) ===
Complete list from battlelog data (15 total):
  bounty, brawlBall, brawlBall5V5, duels, duoShowdown, gemGrab, heist, hotZone,
  knockout, soloShowdown, trioShowdown, unknown, wipeout, wipeout5V5

=== BATTLE STRUCTURE BY MODE TYPE ===

1. Team Modes (3v3) - Standard competitive modes
   Modes: brawlBall, gemGrab, bounty, knockout, hotZone, siege, heist, wipeout
   Structure:
     - battle.mode = event.mode (same)
     - teams[] with 2 teams of 3 players each
     - result ("victory"/"defeat"), duration, starPlayer
     - trophyChange (except friendlies)

2. Team Modes (5v5) - Special 5v5 variants
   Modes: brawlBall5V5, wipeout5V5
   Structure:
     - event.mode has "5V5" suffix (e.g., "brawlBall5V5")
     - battle.mode is base mode (e.g., "brawlBall")
     - teams[] with 2 teams of 5 players each (instead of 3)
     - Same structure as 3v3 otherwise

3. Showdown Modes - Battle royale
   Modes: soloShowdown (1 player), duoShowdown (2 players), trioShowdown (3 players)
   Structure:
     - soloShowdown: players[] array (no teams)
     - duoShowdown: teams[] array with 2 players each
     - trioShowdown: event.mode="trioShowdown", battle.mode="duoShowdown", teams[] with 3 players each
     - rank (placement 1-10)
     - NO result, duration, starPlayer, trophyChange

4. Duels Mode - 1v1 with multiple brawlers
   Mode: duels
   Structure:
     - players[] array with 2 players (1v1)
     - Each player has brawlers[] array (3 brawlers each)
     - Each brawler has its own trophyChange
     - result ("victory"/"defeat"), duration
     - NO starPlayer, NO battle-level trophyChange

5. PvE Modes - Player vs Environment
   Mode: lastStand
   Structure:
     - event.mode = "unknown", battle.mode = "lastStand"
     - players[] array
     - result ("victory"/"defeat"), level object
     - battle.type = null
     - NO trophyChange, NO starPlayer

6. Unknown Event Mode
   event.mode = "unknown" appears for:
     - lastStand (PvE) - 288 battles
     - siege (ranked) - 102 battles
     - Edge cases: brawlBall, soloShowdown

=== TROPHY CHANGE INFERENCE ===
won = trophy_change > 0 → True
won = trophy_change < 0 → False
won = trophy_change == 0 → None (friendly/undetermined)
won = (use result field) → for modes without trophyChange (showdown, lastStand)
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

    def is_team_mode(self) -> bool:
        """Check if this is a team-based mode (3v3)."""
        return self.mode in {
            'brawlBall', 'gemGrab', 'bounty', 'knockout',
            'hotZone', 'siege', 'heist', 'wipeout'
        }

    def is_showdown_mode(self) -> bool:
        """Check if this is a showdown mode (battle royale)."""
        return self.mode in {'soloShowdown', 'duoShowdown', 'trioShowdown'}

    def is_duels_mode(self) -> bool:
        """Check if this is duels mode (1v1 with multiple brawlers)."""
        return self.mode == 'duels'

    def is_pve_mode(self) -> bool:
        """Check if this is a PvE mode (player vs environment)."""
        return self.mode == 'lastStand'


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
