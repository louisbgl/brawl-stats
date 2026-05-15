"""
API playground - edit freely, not part of data collection

# Battle log structure (from comprehensive battlelog analysis)
#
# Battle types (battle.type):
#   "ranked"      - Ladder/trophy system (normal matchmaking with trophyChange)
#   "soloRanked"  - Competitive Ranked (ELO-based, no trophyChange, brawlers at 1-16 trophies)
#   "friendly"    - Friendly matches (no trophyChange)
#   null          - Special events/PvE (e.g., lastStand)
#
# Each battle always has:
#   battleTime          "20260325T005836.000Z" - use fr_time() to convert
#   event.id            numeric event id
#   event.mode          15 possible values (see battle_models.py for complete list)
#   event.modeId        numeric mode id
#   event.map           map name
#   battle.mode         usually same as event.mode (exception: trioShowdown, 5v5 variants)
#   battle.type         see battle types above
#
# Structure varies by mode type:
#   Team modes (3v3/5v5): battle.teams, battle.result, battle.duration, battle.starPlayer
#   Showdown modes: battle.rank, battle.teams (duo/trio) or battle.players (solo)
#   Duels: battle.players (each has brawlers[] array), each brawler has trophyChange
#   PvE (lastStand): battle.players, battle.level, battle.result (no trophyChange)
#
# Trophy changes:
#   Ladder (ranked): has battle.trophyChange
#   Competitive (soloRanked): NO trophyChange
#   Duels: each brawler in players[].brawlers[] has its own trophyChange
#   Everything else: NO trophyChange
"""

import sys
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Add project root to path so imports work when running from root
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.api import api_call
from src.config import CLUBS, INDIVIDUAL_PLAYERS


# ── helpers ──────────────────────────────────────────────────────────────────

def call(endpoint):
    endpoint = endpoint.replace("#", "%23")
    try:
        return api_call(endpoint).json()
    except Exception as e:
        print(f"ERROR: {endpoint}\n{e}")
        return None

def pretty(data):
    print(json.dumps(data, indent=2, ensure_ascii=False))

def fr_time(battle_time):
    dt = datetime.strptime(battle_time, "%Y%m%dT%H%M%S.%fZ").replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone(timedelta(hours=1))).strftime("%d/%m/%Y %H:%M:%S")


# ── keys analysis ─────────────────────────────────────────────────────────────

def _get_nested(item, field):
    for part in field.split("."):
        if not isinstance(item, dict):
            return None
        item = item.get(part)
    return item

def _find_condition(present, absent, all_items):
    if not absent:
        return None
    candidates = set()
    for item in all_items:
        if not isinstance(item, dict):
            continue
        for k, v in item.items():
            if isinstance(v, (str, int, bool)):
                candidates.add(k)
            elif isinstance(v, dict):
                for kk, vv in v.items():
                    if isinstance(vv, (str, int, bool)):
                        candidates.add(f"{k}.{kk}")
    best_label, best_score = None, 0.0
    for field in candidates:
        present_vals = [_get_nested(i, field) for i in present]
        absent_vals  = [_get_nested(i, field) for i in absent]
        present_set  = set(v for v in present_vals if v is not None)
        absent_set   = set(v for v in absent_vals  if v is not None)
        only_absent  = absent_set - present_set
        if only_absent:
            score = sum(1 for v in absent_vals if v in only_absent) / len(absent)
            if score > best_score:
                best_score = score
                vals = ", ".join(f'"{v}"' for v in sorted(str(v) for v in only_absent))
                best_label = f"missing when {field} = {vals}"
        only_present = present_set - absent_set
        if only_present:
            score = sum(1 for v in present_vals if v in only_present) / len(present)
            if score > best_score:
                best_score = score
                vals = ", ".join(f'"{v}"' for v in sorted(str(v) for v in only_present))
                best_label = f"only when {field} = {vals}"
    if best_label and best_score < 1.0:
        best_label += f" ({best_score:.0%})"
    return best_label

def _analyze(items, path="root"):
    items = [i for i in items if isinstance(i, dict)]
    if not items:
        return
    total    = len(items)
    all_keys = set(k for i in items for k in i)
    always, conditional = [], []
    for key in sorted(all_keys):
        present = [i for i in items if key in i]
        absent  = [i for i in items if key not in i]
        if len(present) == total:
            always.append(key)
        else:
            conditional.append((key, len(present), _find_condition(present, absent, items)))
    print(f"\n{'─'*60}\n  {path}  ({total} item{'s' if total > 1 else ''})\n{'─'*60}")
    if always:
        print(f"  ALWAYS ({len(always)}):")
        for k in always:
            print(f"    {k}")
    if conditional:
        print(f"  CONDITIONAL ({len(conditional)}):")
        for key, count, condition in conditional:
            print(f"    {key}  ← {condition or f'{count}/{total} items'}")
    for key in always:
        nested = [i[key] for i in items if key in i]
        if nested and isinstance(nested[0], dict):
            _analyze(nested, f"{path}.{key}")
        elif nested and isinstance(nested[0], list):
            flat = [v for sub in nested for v in sub if isinstance(v, dict)]
            if flat:
                _analyze(flat, f"{path}.{key}[]")

def keys(data):
    """Analyze which keys always exist vs conditionally across the response items."""
    items = data.get("items", data) if isinstance(data, dict) else data
    _analyze(items if isinstance(items, list) else [items])


# ── battle log printer ────────────────────────────────────────────────────────

def print_battles(data):
    """Print a clean human-readable summary of each battle in the log."""
    items = data.get("items", [])
    for i, entry in enumerate(items, 1):
        b      = entry["battle"]
        event  = entry["event"]
        result = b.get("result", "")
        rank   = b.get("rank")
        tc     = b.get("trophyChange")
        star   = b.get("starPlayer", {})
        dur    = b.get("duration")

        # header
        time_str   = fr_time(entry["battleTime"])
        result_str = result.upper() if result else (f"RANK #{rank}" if rank else "?")
        tc_str     = (f"  {'+' if tc > 0 else ''}{tc} trophies" if tc is not None else "")
        print(f"\n[{i:02}] {time_str}  —  {event['mode']} / {event['map']}")
        print(f"     {b['type']}  →  {result_str}{tc_str}", end="")
        if dur:
            print(f"  ({dur}s)", end="")
        print()

        # star player
        if star:
            print(f"     ⭐ {star['name']} ({star['brawler']['name']})")

        # teams
        teams = b.get("teams", [])
        for t, team in enumerate(teams, 1):
            players_str = ",  ".join(
                f"{p['name']} [{p['brawler']['name']} p{p['brawler']['power']}]"
                for p in team
            )
            print(f"     team {t}: {players_str}")


# ── data fetching ─────────────────────────────────────────────────────────────

def all_player_tags():
    """Return all tracked tags: club members + individual players."""
    tags = [p["tag"] for p in INDIVIDUAL_PLAYERS]
    for club in CLUBS:
        club_data = call(f"clubs/{club['tag']}")
        if club_data:
            tags += [m["tag"] for m in club_data.get("members", [])]
    return list(set(tags))

def fetch_all_battle_items():
    """Fetch and merge battle log items across all tracked players."""
    tags = all_player_tags()
    all_items = []
    for tag in tags:
        data = call(f"players/{tag}/battlelog")
        if data:
            all_items += data.get("items", [])
        print(f"  fetched {tag}  ({len(all_items)} total battles so far)")
    return all_items


def print_stored_battles(tag: str):
    """Load and print all stored battles for a player."""
    from src.battle_store import load_raw
    items = load_raw(tag)
    if not items:
        print(f"No stored battles for {tag}")
        return
    print(f"{len(items)} stored battles for {tag}")
    print_battles({"items": items})


def update_all_battlelogs():
    """Fetch and persist new battles for every tracked player."""
    from src.battle_store import update
    for tag in all_player_tags():
        new, total = update(tag)
        print(f"  {tag}  +{new} new  ({total} total)")

def get_brawlers_json_as_dict():
    """Fetch brawlers.json, returns dict with brawler name as key"""
    response = call("brawlers")
    if not response or "items" not in response:
        return {}
    return {b["name"]: b for b in response["items"]}

# ── snapshot comparison ───────────────────────────────────────────────────

def compare_snapshot(tag: str):
    """Compare API response vs what we store in snapshots."""
    from src.models import create_player_snapshot

    # Fetch raw API data
    api_data = call(f"players/{tag}")
    if not api_data:
        print("Failed to fetch API data")
        return

    # Create snapshot (what we store) - now returns dict
    snapshot_dict = create_player_snapshot(api_data)

    print(f"\n{'='*60}")
    print(f"SNAPSHOT COMPARISON: {tag}")
    print(f"{'='*60}\n")

    # Compare top-level player fields
    print("PLAYER FIELDS:")
    print(f"  Stored fields: {sorted(snapshot_dict.keys())}")
    print(f"  API fields: {sorted(api_data.keys())}")

    stored_set = set(snapshot_dict.keys())
    api_set = set(api_data.keys())

    only_stored = stored_set - api_set
    only_api = api_set - stored_set

    if only_stored:
        print(f"\n  ⚠️  Fields ADDED by snapshot (not in API): {sorted(only_stored)}")
    if only_api:
        print(f"\n  ⚠️  Fields DISCARDED (in API, not stored): {sorted(only_api)}")

    # Compare brawler fields
    if api_data.get('brawlers') and snapshot_dict['brawlers']:
        api_brawler = api_data['brawlers'][0]
        stored_brawler = snapshot_dict['brawlers'][0]

        print(f"\n\nBRAWLER FIELDS (using first brawler as example):")
        print(f"  Stored fields: {sorted(stored_brawler.keys())}")
        print(f"  API fields: {sorted(api_brawler.keys())}")

        stored_b_set = set(stored_brawler.keys())
        api_b_set = set(api_brawler.keys())

        only_stored_b = stored_b_set - api_b_set
        only_api_b = api_b_set - stored_b_set

        if only_stored_b:
            print(f"\n  ⚠️  Fields ADDED by snapshot: {sorted(only_stored_b)}")
        if only_api_b:
            print(f"\n  ⚠️  Fields DISCARDED: {sorted(only_api_b)}")

        # Show ID extraction
        print(f"\n\n  ID EXTRACTION EXAMPLES:")
        print(f"    API gadgets: {api_brawler.get('gadgets', [])}")
        print(f"    Stored gadget_ids: {stored_brawler.get('gadget_ids', [])}")

        print(f"\n    API starPowers: {api_brawler.get('starPowers', [])}")
        print(f"    Stored star_power_ids: {stored_brawler.get('star_power_ids', [])}")

        if api_brawler.get('gears'):
            print(f"\n    API gears: {api_brawler.get('gears', [])}")
            print(f"    Stored gear_ids: {stored_brawler.get('gear_ids', [])}")

    print(f"\n{'='*60}")


def discover_all_fields():
    """Fetch all tracked players and discover all possible API fields."""
    from src.config import get_all_tracked_player_tags

    print(f"\n{'='*60}")
    print("DISCOVERING ALL API FIELDS")
    print(f"{'='*60}\n")

    # Get all tracked players
    players = get_all_tracked_player_tags()
    print(f"Fetching {len(players)} players...")

    # Collect all fields across all players
    all_player_fields = set()
    all_brawler_fields = set()
    all_gadget_fields = set()
    all_star_power_fields = set()
    all_hyper_charge_fields = set()
    all_gear_fields = set()
    all_club_fields = set()

    player_field_types = {}
    brawler_field_types = {}

    for i, (tag, name) in enumerate(players, 1):
        print(f"  [{i}/{len(players)}] {name} ({tag})...", end=" ")

        data = call(f"players/{tag}")
        if not data:
            print("✗ failed")
            continue

        print("✓")

        # Collect player fields
        for field, value in data.items():
            all_player_fields.add(field)
            if field not in player_field_types:
                player_field_types[field] = type(value).__name__

        # Collect club fields
        if 'club' in data and data['club']:
            for field in data['club'].keys():
                all_club_fields.add(field)

        # Collect brawler fields
        for brawler in data.get('brawlers', []):
            for field, value in brawler.items():
                all_brawler_fields.add(field)
                if field not in brawler_field_types:
                    brawler_field_types[field] = type(value).__name__

            # Collect item fields
            for gadget in brawler.get('gadgets', []):
                all_gadget_fields.update(gadget.keys())

            for sp in brawler.get('starPowers', []):
                all_star_power_fields.update(sp.keys())

            for hc in brawler.get('hyperCharges', []):
                all_hyper_charge_fields.update(hc.keys())

            for gear in brawler.get('gears', []):
                all_gear_fields.update(gear.keys())

    # Print results
    print(f"\n{'='*60}")
    print("PLAYER FIELDS")
    print(f"{'='*60}")
    for field in sorted(all_player_fields):
        field_type = player_field_types.get(field, 'unknown')
        print(f"  {field:45} {field_type}")

    print(f"\n{'='*60}")
    print("BRAWLER FIELDS")
    print(f"{'='*60}")
    for field in sorted(all_brawler_fields):
        field_type = brawler_field_types.get(field, 'unknown')
        print(f"  {field:45} {field_type}")

    if all_club_fields:
        print(f"\n{'='*60}")
        print("CLUB FIELDS (nested in player.club)")
        print(f"{'='*60}")
        for field in sorted(all_club_fields):
            print(f"  {field}")

    if all_gadget_fields:
        print(f"\n{'='*60}")
        print("GADGET FIELDS")
        print(f"{'='*60}")
        for field in sorted(all_gadget_fields):
            print(f"  {field}")

    if all_star_power_fields:
        print(f"\n{'='*60}")
        print("STAR POWER FIELDS")
        print(f"{'='*60}")
        for field in sorted(all_star_power_fields):
            print(f"  {field}")

    if all_hyper_charge_fields:
        print(f"\n{'='*60}")
        print("HYPER CHARGE FIELDS")
        print(f"{'='*60}")
        for field in sorted(all_hyper_charge_fields):
            print(f"  {field}")

    if all_gear_fields:
        print(f"\n{'='*60}")
        print("GEAR FIELDS")
        print(f"{'='*60}")
        for field in sorted(all_gear_fields):
            print(f"  {field}")

    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"  Total players scanned: {len(players)}")
    print(f"  Unique player fields: {len(all_player_fields)}")
    print(f"  Unique brawler fields: {len(all_brawler_fields)}")
    if all_club_fields:
        print(f"  Unique club fields: {len(all_club_fields)}")
    print(f"{'='*60}\n")

def has_buffies(brawler):
    """Check if a brawler has buffies, and which ones."""
    buffies = []
    if brawler.get("buffies"):
        if brawler["buffies"].get("gadget"):
            buffies.append("gadget")
        if brawler["buffies"].get("starPower"):
            buffies.append("starPower")
        if brawler["buffies"].get("hyperCharge"):
            buffies.append("hyperCharge")
    return buffies

def get_list_of_brawlers_with_buffies(player_data):
    """Return a list of brawlers that have buffies, along with which buffies they have."""
    brawlers_with_buffies = []
    for brawler in player_data.get("brawlers", []):
        buffies = has_buffies(brawler)
        if buffies:
            brawlers_with_buffies.append((brawler["name"], buffies))
    return brawlers_with_buffies

def print_cross_table_brawlers_buffies(player_data):
    """Print a cross-table of brawlers vs buffies for a player."""
    buffied_list = get_list_of_brawlers_with_buffies(player_data)
    if not buffied_list:
        print("No brawlers with buffies found.")
        return
    
    yes_emoji = "✅"
    no_emoji = "❌"
    
    print(f"\n{'Brawler':10} | {'Gadget Buffie'} | {'Star Power Buffie'} | {'Hyper Charge Buffie'}")
    print(f"{'-'*10}-+-{'-'*13}-+-{'-'*17}-+-{'-'*19}")
    for brawler_name, buffies in buffied_list:
        gadget_buffie = yes_emoji if "gadget" in buffies else no_emoji
        star_power_buffie = yes_emoji if "starPower" in buffies else no_emoji
        hyper_charge_buffie = yes_emoji if "hyperCharge" in buffies else no_emoji
        print(f"{brawler_name:10} | {gadget_buffie:^12} | {star_power_buffie:^16} | {hyper_charge_buffie:^19}")

# ── main ──────────────────────────────────────────────────────────────────────

def main():
    ESCORTE = "#LLJGJQVY"
    KOKONUT = "#98QG0VCJ2"
    FRED = "#2L0U0PGRL"

    brawlers = get_brawlers_json_as_dict()

    my_snapshot = call(f"players/{ESCORTE}")
    # my_brawlers = my_snapshot.get("brawlers", [])

    print(f"Player: {my_snapshot.get('name')} ({my_snapshot.get('tag')})")
    print_cross_table_brawlers_buffies(my_snapshot)

    kokonut_snapshot = call(f"players/{KOKONUT}")
    print(f"\nPlayer: {kokonut_snapshot.get('name')} ({kokonut_snapshot.get('tag')})")
    print_cross_table_brawlers_buffies(kokonut_snapshot)

if __name__ == "__main__":
    main()
