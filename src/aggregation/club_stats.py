"""
Club-wide statistics generation.

Generates club summary with quick stats, trophy timeline, and leaderboards.
"""

from pathlib import Path
from typing import Dict, List, Set, Any
from datetime import datetime, timezone
from collections import Counter


def generate_club_summary(
    raw_dir: Path,
    player_index: Dict,
    snapshot_loader,
    battlelog_loader,
    extract_item_ids_func
) -> Dict:
    """
    Generate club-summary.json (Overview tab data).

    Args:
        raw_dir: Path to raw data directory
        player_index: Dict of {tag: {name}}
        snapshot_loader: Function that loads snapshots
        battlelog_loader: Function that loads battlelogs
        extract_item_ids_func: Function to extract item IDs

    Returns:
        Club summary dict with quick_stats, trophy_timeline, leaderboards
    """
    print("\nGenerating club summary...")

    # Load latest snapshot
    latest = snapshot_loader('latest')
    players = _get_all_players(latest)

    # Load all battlelogs for club-wide stats
    print("  Loading battlelogs for quick stats...")
    all_player_battles = {}
    total_battles_count = 0
    total_wins = 0
    mode_counts = Counter()

    for player in players:
        tag = player['tag']
        battles = battlelog_loader(tag)
        all_player_battles[tag] = battles

        for battle in battles:
            total_battles_count += 1

            # Count wins
            battle_data = battle.get('battle', {})
            result = battle_data.get('result')
            trophy_change = battle_data.get('trophyChange', 0)

            # Infer result from trophy change if missing
            if not result:
                if trophy_change > 0:
                    result = 'victory'
                elif trophy_change < 0:
                    result = 'defeat'

            if result == 'victory':
                total_wins += 1

            # Count mode
            mode = battle.get('event', {}).get('mode')
            if mode:
                mode_counts[mode] += 1

    # Quick stats
    total_trophies = sum(p.get('trophies', 0) for p in players)
    avg_winrate = (total_wins / total_battles_count) if total_battles_count > 0 else 0.0
    fav_mode = mode_counts.most_common(1)[0][0] if mode_counts else None

    quick_stats = {
        'total_members': len(players),
        'total_trophies': total_trophies,
        'total_battles': total_battles_count,
        'avg_winrate': round(avg_winrate, 3),
        'fav_mode': fav_mode
    }

    # Trophy timeline - per-player trophies map
    print("  Building trophy timeline...")
    timeline = []
    snapshot_files = sorted((raw_dir / "snapshots").glob("????-??-??.json.gz"))

    for snap_file in snapshot_files:
        date = snap_file.name.replace('.json.gz', '')  # YYYY-MM-DD
        snapshot = snapshot_loader(date)
        players_snap = _get_all_players(snapshot)

        players_map = {}
        for p in players_snap:
            players_map[p['tag']] = p.get('trophies', 0)

        timeline.append({
            'date': date,
            'players': players_map
        })

    # Leaderboards (using latest snapshot + battlelogs)
    print("  Calculating leaderboards...")
    leaderboards = _calculate_leaderboards(players, all_player_battles, extract_item_ids_func)

    summary = {
        'version': 1,
        'generated_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'quick_stats': quick_stats,
        'trophy_timeline': timeline,
        'leaderboards': leaderboards
    }

    return summary


def _get_all_players(snapshot: Dict) -> List[Dict]:
    """Extract all players from snapshot"""
    players = []
    for club in snapshot.get('clubs', []):
        players.extend(club.get('members', []))
    players.extend(snapshot.get('individual_players', []))
    return players


def _calculate_leaderboards(players: List[Dict], all_player_battles: Dict[str, List], extract_item_ids_func) -> Dict:
    """Calculate all leaderboards from player list + battlelogs"""

    # Helper: sort with tiebreak by name
    def sort_players(players_list, key_func, reverse=True):
        return sorted(players_list,
                     key=lambda p: (key_func(p), p['name']),
                     reverse=reverse)

    # Helper: format leaderboard (tag + name + value, no rank)
    def format_lb(players_list, value_key):
        return [
            {
                'tag': p['tag'],
                'name': p['name'],
                'value': value_key(p)
            }
            for p in players_list
        ]

    # Helper: check if brawler is maxed (P11 + 2 gadgets + 2 SPs + 1 HC)
    def is_maxed(brawler: Dict) -> bool:
        gadgets = extract_item_ids_func(brawler.get('gadgets'))
        sps = extract_item_ids_func(brawler.get('starPowers'))
        hcs = extract_item_ids_func(brawler.get('hyperCharges'))
        return (
            brawler.get('power') == 11 and
            len(gadgets) >= 2 and
            len(sps) >= 2 and
            len(hcs) >= 1
        )

    # 1. Trophies
    trophies_lb = sort_players(players, lambda p: p.get('trophies', 0))

    # 2. Ranked Best Rank (lower = better)
    ranked_lb = sort_players(
        players,
        lambda p: p.get('highestAllTimeRankedRank', 999),
        reverse=False  # Ascending - rank 1 is best
    )

    # 3. Win Rate (from battlelogs)
    player_winrates = []
    for p in players:
        tag = p['tag']
        battles = all_player_battles.get(tag, [])
        if not battles:
            continue

        wins = 0
        total = 0
        for battle in battles:
            total += 1
            battle_data = battle.get('battle', {})
            result = battle_data.get('result')
            trophy_change = battle_data.get('trophyChange', 0)

            if not result:
                if trophy_change > 0:
                    result = 'victory'
                elif trophy_change < 0:
                    result = 'defeat'

            if result == 'victory':
                wins += 1

        if total > 0:
            player_winrates.append((p, wins / total))

    winrate_lb = sorted(player_winrates, key=lambda x: (x[1], x[0]['name']), reverse=True)

    # 4. Total Battles (from battlelogs)
    battles_lb = sort_players(
        players,
        lambda p: len(all_player_battles.get(p['tag'], []))
    )

    # 5. Maxed Brawlers
    def count_maxed(p):
        return sum(1 for b in p.get('brawlers', []) if is_maxed(b))

    maxed_lb = sort_players(players, count_maxed)

    # 6. Brawlers 1000+ Trophies
    def count_1k(p):
        return sum(1 for b in p.get('brawlers', []) if b.get('trophies', 0) >= 1000)

    brawlers_1k_lb = sort_players(players, count_1k)

    # Dynamic leaderboards (2k+, 3k+) - only if threshold met
    def count_2k(p):
        return sum(1 for b in p.get('brawlers', []) if b.get('trophies', 0) >= 2000)

    def count_3k(p):
        return sum(1 for b in p.get('brawlers', []) if b.get('trophies', 0) >= 3000)

    players_2k = [p for p in players if count_2k(p) > 0]
    players_3k = [p for p in players if count_3k(p) > 0]

    leaderboards = {
        'trophies': format_lb(trophies_lb, lambda p: p.get('trophies', 0)),
        'ranked_best': format_lb(ranked_lb, lambda p: p.get('highestAllTimeRankedRank', 999)),
        'winrate': [{'tag': p[0]['tag'], 'name': p[0]['name'], 'value': round(p[1], 3)} for p in winrate_lb],
        'total_battles': format_lb(battles_lb, lambda p: len(all_player_battles.get(p['tag'], []))),
        'maxed_brawlers': format_lb(maxed_lb, count_maxed),
        'brawlers_1k': format_lb(brawlers_1k_lb, count_1k)
    }

    # Add dynamic leaderboards if threshold met
    if players_2k:
        brawlers_2k_lb = sort_players(players_2k, count_2k)
        leaderboards['brawlers_2k'] = format_lb(brawlers_2k_lb, count_2k)

    if players_3k:
        brawlers_3k_lb = sort_players(players_3k, count_3k)
        leaderboards['brawlers_3k'] = format_lb(brawlers_3k_lb, count_3k)

    return leaderboards
