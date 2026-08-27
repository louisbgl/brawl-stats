"""
Battle flattening utilities for converting raw API battles to flat player-centric format.

Handles all 23 game modes with consistent player array structure.
"""

import json
from pathlib import Path
from typing import Dict, List, Set, Optional


def load_player_index(index_file: Path) -> Set[str]:
    """Load tracked player tags from player index."""
    with open(index_file) as f:
        index = json.load(f)
    return set(index.keys())


def normalize_battle_to_players(battle_raw: dict, owner_tag: str, tracked_tags: Set[str]) -> List[dict]:
    """
    Convert raw battle format to flat player list.
    Returns list of player dicts for this battle.

    All modes produce consistent player objects:
    - tag, name, brawler, power, trophies, trophyChange, result, team
    - Duels/tagTeam: additional 'brawlers' array with all 3 brawlers
    - Tracked players: trophyChange !== null (0 if API missing data)
    - Non-tracked: trophyChange = null
    """
    battle = battle_raw.get("battle", {})
    event = battle_raw.get("event", {})
    battle_time = battle_raw["battleTime"]

    mode = event.get("mode", "unknown")
    battle_mode = battle.get("mode", mode)
    map_name = event.get("map", "Unknown")
    battle_type = battle.get("type")

    players = []

    # Team modes (3v3, 5v5)
    if "teams" in battle and battle.get("result"):
        result = battle["result"]  # "victory" or "defeat" from owner's perspective
        trophy_change = battle.get("trophyChange")

        # Find which team is owner's
        owner_team_idx = None
        for team_idx, team in enumerate(battle["teams"]):
            if any(p["tag"] == owner_tag for p in team):
                owner_team_idx = team_idx
                break

        for team_idx, team in enumerate(battle["teams"]):
            # Determine result for this team
            if owner_team_idx is not None:
                if team_idx == owner_team_idx:
                    team_result = result
                    team_trophy_change = trophy_change
                else:
                    team_result = "defeat" if result == "victory" else "victory"
                    team_trophy_change = -trophy_change if trophy_change else None
            else:
                team_result = None
                team_trophy_change = None

            for player in team:
                brawler_data = player.get("brawler", {})
                player_tag = player["tag"]

                # Trophy change assignment:
                # - Tracked players: use actual value OR 0 as placeholder (ensures !== null)
                # - Non-tracked: null
                if player_tag in tracked_tags:
                    tc = team_trophy_change if team_trophy_change is not None else 0
                else:
                    tc = None

                players.append({
                    "tag": player_tag,
                    "name": player["name"],
                    "brawler": brawler_data.get("name"),
                    "power": brawler_data.get("power"),
                    "trophies": brawler_data.get("trophies"),
                    "trophyChange": tc,
                    "result": team_result,
                    "team": team_idx
                })

    # Duels/tagTeam modes - each player has multiple brawlers
    elif battle_mode == "duels":
        result = battle.get("result")  # owner's result

        for player_idx, player in enumerate(battle.get("players", [])):
            player_tag = player["tag"]
            is_owner = player_tag == owner_tag
            is_tracked = player_tag in tracked_tags

            # In duels/tagTeam, each player uses 3 brawlers
            brawlers_raw = player.get("brawlers", [])

            if is_tracked and brawlers_raw:
                # Sum trophy changes for tracked players
                total_trophy_change = sum(b.get("trophyChange", 0) for b in brawlers_raw)
                # Use first brawler for display
                primary_brawler = brawlers_raw[0]

                # Tracked player: use actual trophy change if owner, else 0 placeholder
                tc = total_trophy_change if is_owner else 0

                # Build brawlers array
                brawlers_list = [{
                    "name": b.get("name"),
                    "power": b.get("power"),
                    "trophies": b.get("trophies"),
                    "trophyChange": b.get("trophyChange", 0) if is_owner else 0
                } for b in brawlers_raw]

                players.append({
                    "tag": player_tag,
                    "name": player["name"],
                    "brawler": primary_brawler.get("name"),
                    "power": primary_brawler.get("power"),
                    "trophies": primary_brawler.get("trophies"),
                    "brawlers": brawlers_list,
                    "trophyChange": tc,
                    "result": result if is_owner else ("defeat" if result == "victory" else "victory"),
                    "team": player_idx
                })
            elif brawlers_raw:
                # Non-tracked: just show first brawler, no trophy change
                primary_brawler = brawlers_raw[0]
                players.append({
                    "tag": player_tag,
                    "name": player["name"],
                    "brawler": primary_brawler.get("name"),
                    "power": primary_brawler.get("power"),
                    "trophies": primary_brawler.get("trophies"),
                    "trophyChange": None,
                    "result": None,
                    "team": player_idx
                })

    # Showdown modes (soloShowdown, duoShowdown, trioShowdown)
    elif "rank" in battle:
        # Showdown: no result field, rank-based
        # trophy_change at battle level for owner only
        trophy_change = battle.get("trophyChange")
        rank = battle.get("rank")

        # Extract all players
        all_players = []
        if "teams" in battle:
            # duoShowdown/trioShowdown
            for team_idx, team in enumerate(battle["teams"]):
                for player in team:
                    all_players.append((player, team_idx))
        else:
            # soloShowdown
            for player in battle.get("players", []):
                all_players.append((player, None))

        for player, team_idx in all_players:
            brawler_data = player.get("brawler", {})
            player_tag = player["tag"]
            is_owner = player_tag == owner_tag
            is_tracked = player_tag in tracked_tags

            # Result based on rank (1-3 = victory, else defeat)
            result = None
            if is_owner or is_tracked:
                result = "victory" if rank and rank <= 3 else "defeat"

            # Trophy change for showdown:
            # - Owner tracked: use actual value OR 0
            # - Non-owner tracked: 0 placeholder
            # - Non-tracked: null
            if is_tracked:
                tc = trophy_change if (is_owner and trophy_change is not None) else 0
            else:
                tc = None

            players.append({
                "tag": player_tag,
                "name": player["name"],
                "brawler": brawler_data.get("name"),
                "power": brawler_data.get("power"),
                "trophies": brawler_data.get("trophies"),
                "trophyChange": tc,
                "result": result,
                "team": team_idx
            })

    # PvE modes (lastStand)
    elif battle_mode == "lastStand":
        result = battle.get("result")

        for player in battle.get("players", []):
            brawler_data = player.get("brawler", {})
            player_tag = player["tag"]
            is_tracked = player_tag in tracked_tags

            # PvE modes: no trophy changes in API, but tracked players get 0 placeholder
            tc = 0 if is_tracked else None

            players.append({
                "tag": player_tag,
                "name": player["name"],
                "brawler": brawler_data.get("name"),
                "power": brawler_data.get("power"),
                "trophies": brawler_data.get("trophies"),
                "trophyChange": tc,
                "result": result if is_tracked else None,
                "team": None
            })

    return players


def merge_tracked_player_data(existing_battle: dict, new_players: List[dict], owner_tag: str):
    """
    Merge tracked player data from new battle version into existing battle.
    Updates trophyChange and result for tracked players when we see them as owner.
    Only overwrites if new value is not 0 (0 = placeholder, real data takes precedence).
    """
    # Build lookup of existing players by tag
    existing_by_tag = {p['tag']: p for p in existing_battle['players']}

    # Find the tracked player who owns this battle version
    owner_data = None
    for p in new_players:
        if p['tag'] == owner_tag and p['trophyChange'] is not None:
            owner_data = p
            break

    if owner_data and owner_data['tag'] in existing_by_tag:
        # Update only if incoming trophy change is not 0 (0 = placeholder)
        # OR if existing is still 0 (first real data)
        if owner_data['trophyChange'] != 0 or existing_by_tag[owner_data['tag']]['trophyChange'] == 0:
            existing_by_tag[owner_data['tag']]['trophyChange'] = owner_data['trophyChange']
            existing_by_tag[owner_data['tag']]['result'] = owner_data['result']
