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

import json
from src.api import api_call
from src.config import CLUBS, INDIVIDUAL_PLAYERS
from datetime import datetime, timezone, timedelta


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


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    ESCORTE = "#LLJGJQVY"
    FRED = "#2L0U0PGRL"
    # data = call(f"players/{ESCORTE}/battlelog")
    # if not data:
    #     return

    print_stored_battles(ESCORTE)


if __name__ == "__main__":
    main()
