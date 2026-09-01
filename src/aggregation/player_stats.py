"""
Per-player statistics generation.

Generates individual player files: stats.json, timeline.json, battle-stats.json, brawlers.json
"""

from pathlib import Path
from typing import Dict, List, Any
from collections import defaultdict, Counter


def generate_player_stats(tag: str, latest_snapshot: Dict, get_all_players_func, extract_item_ids_func, battlelog_loader=None) -> Dict:
    """Generate players/{TAG}/stats.json"""
    players = get_all_players_func(latest_snapshot)
    player = next((p for p in players if p['tag'] == tag), None)

    if not player:
        return {}

    brawlers = player.get('brawlers', [])

    # Quick stats
    quick_stats = {
        'trophies': player.get('trophies', 0),
        'highest_trophies': player.get('highestTrophies', 0),
        'exp_level': player.get('expLevel', 0),
        'wins_3v3': player.get('3vs3Victories', 0),
        'wins_solo': player.get('soloVictories', 0),
        'wins_duo': player.get('duoVictories', 0),
        'brawlers_owned': len(brawlers)
    }

    # Battle stats from battlelogs (overall WR, MVP count, MVP rate)
    if battlelog_loader:
        battles = battlelog_loader(tag)
        total_battles = len(battles)
        wins = 0
        mvp_count = 0

        for battle in battles:
            battle_data = battle.get('battle', {})

            # Count wins
            result = battle_data.get('result')
            trophy_change = battle_data.get('trophyChange', 0)
            if not result:
                # Fallback: infer from trophy change
                if trophy_change > 0:
                    result = 'victory'
            if result == 'victory':
                wins += 1

            # Count MVPs (star player)
            star_player = battle_data.get('starPlayer')
            if star_player and star_player.get('tag') == tag:
                mvp_count += 1

        quick_stats['total_battles'] = total_battles
        quick_stats['overall_winrate'] = round(wins / total_battles, 3) if total_battles > 0 else 0
        quick_stats['mvp_count'] = mvp_count
        quick_stats['mvp_rate'] = round(mvp_count / total_battles, 3) if total_battles > 0 else 0

    # Prestige distribution
    prestige_dist = Counter()
    for b in brawlers:
        trophies = b.get('trophies', 0)
        if trophies >= 1000:
            prestige = trophies // 1000
            prestige_dist[prestige] += 1

    # Power distribution
    power_dist = Counter(b.get('power', 0) for b in brawlers)

    stats = {
        'quick_stats': quick_stats,
        'prestige_distribution': dict(prestige_dist),
        'power_distribution': dict(power_dist)
    }

    return stats


def generate_player_timeline(tag: str, snapshot_files: List[Path], snapshot_loader, battlelog_loader, get_all_players_func) -> Dict:
    """Generate players/{TAG}/timeline.json"""
    timeline_data = {
        'trophy_progression': [],
        'mode_distribution': []
    }

    # Trophy progression - iterate all snapshots
    for snap_file in snapshot_files:
        # Get date from filename (remove .json.gz)
        date = snap_file.name.replace('.json.gz', '')
        snapshot = snapshot_loader(date)
        players = get_all_players_func(snapshot)
        player = next((p for p in players if p['tag'] == tag), None)

        if player:
            timeline_data['trophy_progression'].append({
                'date': date,
                'trophies': player.get('trophies', 0)
            })

    # Mode distribution from battlelogs
    battles = battlelog_loader(tag)
    mode_counts = Counter()

    for battle in battles:
        event = battle.get('event', {})
        mode = event.get('mode')
        if mode:
            mode_counts[mode] += 1

    # Format as array sorted by count
    timeline_data['mode_distribution'] = [
        {'mode': mode, 'count': count}
        for mode, count in mode_counts.most_common()
    ]

    return timeline_data


def generate_player_battle_stats(tag: str, battlelog_loader) -> Dict:
    """Generate players/{TAG}/battle-stats.json"""
    battles = battlelog_loader(tag)

    if not battles:
        return {
            'performance_stats': {},
            'brawler_stats': [],
            'teammate_chemistry': []
        }

    # Performance stats by mode
    mode_stats = defaultdict(lambda: {'wins': 0, 'losses': 0, 'total': 0})

    for battle in battles:
        event = battle.get('event', {})
        mode = event.get('mode')
        battle_data = battle.get('battle', {})

        if not mode:
            continue

        # Determine win/loss
        result = battle_data.get('result')  # "victory" or "defeat"
        trophy_change = battle_data.get('trophyChange', 0)

        # Fallback: infer from trophy change if result missing
        if not result:
            if trophy_change > 0:
                result = 'victory'
            elif trophy_change < 0:
                result = 'defeat'

        mode_stats[mode]['total'] += 1
        if result == 'victory':
            mode_stats[mode]['wins'] += 1
        elif result == 'defeat':
            mode_stats[mode]['losses'] += 1

    # Format performance stats
    performance_stats = {}
    for mode, stats in mode_stats.items():
        total = stats['total']
        wins = stats['wins']
        performance_stats[mode] = {
            'wins': wins,
            'losses': stats['losses'],
            'total': total,
            'win_rate': round(wins / total * 100, 1) if total > 0 else 0
        }

    # Brawler stats (per brawler win/loss)
    brawler_stats = defaultdict(lambda: {'wins': 0, 'losses': 0, 'total': 0, 'trophy_change': 0})

    for battle in battles:
        battle_data = battle.get('battle', {})
        result = battle_data.get('result')
        trophy_change = battle_data.get('trophyChange', 0)

        # Find player's brawler
        brawler_name = None
        teams = battle_data.get('teams', [])
        players = battle_data.get('players', [])

        # Team modes
        for team in teams:
            for p in team:
                if p.get('tag') == tag:
                    brawler_name = p.get('brawler', {}).get('name')
                    break

        # Showdown/solo modes
        if not brawler_name:
            for p in players:
                if p.get('tag') == tag:
                    brawler_name = p.get('brawler', {}).get('name')
                    break

        if brawler_name:
            brawler_stats[brawler_name]['total'] += 1
            brawler_stats[brawler_name]['trophy_change'] += trophy_change

            if result == 'victory':
                brawler_stats[brawler_name]['wins'] += 1
            elif result == 'defeat':
                brawler_stats[brawler_name]['losses'] += 1

    # Format brawler stats (sorted by total games)
    brawler_list = []
    for brawler, stats in brawler_stats.items():
        total = stats['total']
        wins = stats['wins']
        brawler_list.append({
            'brawler': brawler,
            'wins': wins,
            'losses': stats['losses'],
            'total': total,
            'win_rate': round(wins / total * 100, 1) if total > 0 else 0,
            'avg_trophy_change': round(stats['trophy_change'] / total, 2) if total > 0 else 0
        })

    brawler_list.sort(key=lambda x: x['total'], reverse=True)

    # Teammate chemistry (who you win most with)
    teammate_stats = defaultdict(lambda: {'games': 0, 'wins': 0})

    for battle in battles:
        battle_data = battle.get('battle', {})
        result = battle_data.get('result')
        teams = battle_data.get('teams', [])

        # Find player's team
        player_team = None
        for team in teams:
            if any(p.get('tag') == tag for p in team):
                player_team = team
                break

        if player_team:
            # Count teammates (exclude self)
            for p in player_team:
                teammate_tag = p.get('tag')
                if teammate_tag and teammate_tag != tag:
                    teammate_stats[teammate_tag]['games'] += 1
                    if result == 'victory':
                        teammate_stats[teammate_tag]['wins'] += 1

    # Format teammate chemistry (min 10 games, sorted by win rate)
    teammate_list = []
    for teammate_tag, stats in teammate_stats.items():
        if stats['games'] >= 10:
            win_rate = round(stats['wins'] / stats['games'] * 100, 1)
            teammate_list.append({
                'teammate_tag': teammate_tag,
                'games': stats['games'],
                'wins': stats['wins'],
                'win_rate': win_rate
            })

    teammate_list.sort(key=lambda x: (x['win_rate'], x['games']), reverse=True)

    return {
        'performance_stats': performance_stats,
        'brawler_stats': brawler_list,
        'teammate_chemistry': teammate_list[:10]  # Top 10
    }


def generate_player_brawlers(tag: str, latest_snapshot: Dict, brawlers_ref: Dict, get_all_players_func, extract_item_ids_func) -> Dict:
    """Generate players/{TAG}/brawlers.json - detailed brawler table"""
    players = get_all_players_func(latest_snapshot)
    player = next((p for p in players if p['tag'] == tag), None)

    if not player:
        return {'brawlers': []}

    brawlers_data = []
    all_brawler_ids = {b['id'] for b in brawlers_ref.get('items', [])}

    # Owned brawlers
    for brawler in player.get('brawlers', []):
        brawler_id = brawler.get('id')
        name = brawler.get('name')
        power = brawler.get('power', 0)
        trophies = brawler.get('trophies', 0)
        rank = brawler.get('rank', 0)

        # Extract items
        gadgets = extract_item_ids_func(brawler.get('gadgets'))
        star_powers = extract_item_ids_func(brawler.get('starPowers'))
        hypercharges = extract_item_ids_func(brawler.get('hyperCharges'))
        gears = extract_item_ids_func(brawler.get('gears'))

        brawlers_data.append({
            'id': brawler_id,
            'name': name,
            'power': power,
            'rank': rank,
            'trophies': trophies,
            'highest_trophies': brawler.get('highestTrophies', 0),
            'gadgets_count': len(gadgets),
            'star_powers_count': len(star_powers),
            'hypercharges_count': len(hypercharges),
            'gears_count': len(gears),
            'owned': True
        })

    # Unowned brawlers (from brawlers.json reference)
    owned_ids = {b.get('id') for b in player.get('brawlers', [])}
    for brawler_ref in brawlers_ref.get('items', []):
        brawler_id = brawler_ref['id']
        if brawler_id not in owned_ids:
            brawlers_data.append({
                'id': brawler_id,
                'name': brawler_ref['name'],
                'power': 0,
                'rank': 0,
                'trophies': 0,
                'highest_trophies': 0,
                'gadgets_count': 0,
                'star_powers_count': 0,
                'hypercharges_count': 0,
                'gears_count': 0,
                'owned': False
            })

    # Sort: owned first (by trophies desc), then unowned (by name)
    brawlers_data.sort(key=lambda b: (
        not b['owned'],  # False (owned) comes before True (unowned)
        -b['trophies'] if b['owned'] else 0,
        b['name']
    ))

    return {'brawlers': brawlers_data}
