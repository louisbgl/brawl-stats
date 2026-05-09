#!/usr/bin/env python3
"""
Migrate old snapshot files from snake_case to raw API camelCase format.

Converts:
  victories_3v3 → 3vs3Victories
  gadget_ids → gadgets (reconstruct full objects from brawlers.json)
  etc.

Run once to normalize all historical snapshots.
"""

import json
import sys
from pathlib import Path

# Load brawlers reference for ID lookups
BRAWLERS_REF = None

def load_brawlers_reference():
    global BRAWLERS_REF
    if BRAWLERS_REF is None:
        ref_file = Path(__file__).parent / 'data' / 'brawlers.json'
        BRAWLERS_REF = json.loads(ref_file.read_text(encoding='utf-8'))
    return BRAWLERS_REF

def find_item_by_id(items, item_id):
    """Find gadget/starPower/hyperCharge/gear by ID."""
    for item in items:
        if item['id'] == item_id:
            return item
    return None

# Field mappings (snake_case → camelCase)
PLAYER_REVERSE_MAP = {
    'victories_3v3': '3vs3Victories',
    'solo_victories': 'soloVictories',
    'duo_victories': 'duoVictories',
    'exp_level': 'expLevel',
    'exp_points': 'expPoints',
    'highest_trophies': 'highestTrophies',
    'total_prestige_level': 'totalPrestigeLevel',
    'name_color': 'nameColor',
    'is_qualified_from_championship_challenge': 'isQualifiedFromChampionshipChallenge',
    'best_robo_rumble_time': 'bestRoboRumbleTime',
    'best_time_as_big_brawler': 'bestTimeAsBigBrawler',
    'ranked_elo': 'rankedElo',
    'ranked_rank': 'rankedRank',
    'ranked_rank_name': 'rankedRankName',
    'ranked_season_id': 'rankedSeasonId',
    'highest_season_ranked_elo': 'highestSeasonRankedElo',
    'highest_season_ranked_rank': 'highestSeasonRankedRank',
    'highest_season_ranked_rank_name': 'highestSeasonRankedRankName',
    'highest_all_time_ranked_elo': 'highestAllTimeRankedElo',
    'highest_all_time_ranked_rank': 'highestAllTimeRankedRank',
    'highest_all_time_ranked_rank_name': 'highestAllTimeRankedRankName',
}

BRAWLER_REVERSE_MAP = {
    'highest_trophies': 'highestTrophies',
    'prestige_level': 'prestigeLevel',
    'current_win_streak': 'currentWinStreak',
    'max_win_streak': 'maxWinStreak',
    'star_powers': 'starPowers',
    'hyper_charges': 'hyperCharges',
}

CLUB_REVERSE_MAP = {
    'required_trophies': 'requiredTrophies',
}


def rename_fields(data: dict, field_map: dict) -> dict:
    """Rename fields according to mapping. Remove unmapped fields."""
    result = {}
    for key, value in data.items():
        if key in field_map:
            result[field_map[key]] = value
        else:
            # Keep field as-is if not in map
            result[key] = value
    return result


def migrate_brawler(brawler: dict) -> dict:
    """Convert brawler from old format (with *_ids) to raw API format."""
    migrated = rename_fields(brawler, BRAWLER_REVERSE_MAP)

    # Reconstruct full objects from ID arrays using brawlers.json reference
    brawler_name = brawler.get('name', '')
    ref = load_brawlers_reference()

    # Find this brawler in reference data
    brawler_ref = None
    for b in ref.get('items', []):
        if b['name'] == brawler_name:
            brawler_ref = b
            break

    if brawler_ref:
        # Reconstruct gadgets from IDs
        if 'gadget_ids' in brawler:
            migrated['gadgets'] = [
                find_item_by_id(brawler_ref.get('gadgets', []), gid)
                for gid in brawler['gadget_ids']
            ]
            migrated['gadgets'] = [g for g in migrated['gadgets'] if g is not None]

        # Reconstruct starPowers from IDs
        if 'star_power_ids' in brawler:
            migrated['starPowers'] = [
                find_item_by_id(brawler_ref.get('starPowers', []), spid)
                for spid in brawler['star_power_ids']
            ]
            migrated['starPowers'] = [sp for sp in migrated['starPowers'] if sp is not None]

        # Reconstruct hyperCharges from IDs
        if 'hyper_charge_ids' in brawler:
            migrated['hyperCharges'] = [
                find_item_by_id(brawler_ref.get('hyperCharges', []), hcid)
                for hcid in brawler['hyper_charge_ids']
            ]
            migrated['hyperCharges'] = [hc for hc in migrated['hyperCharges'] if hc is not None]

        # Reconstruct gears from IDs (gears have level, need special handling)
        if 'gear_ids' in brawler:
            # Can't reconstruct gear levels from just IDs, only ID + name
            migrated['gears'] = [
                {'id': gid, 'name': find_item_by_id(brawler_ref.get('gears', []), gid).get('name') if find_item_by_id(brawler_ref.get('gears', []), gid) else 'Unknown', 'level': 1}
                for gid in brawler['gear_ids']
            ]

    # Remove old ID arrays
    migrated.pop('gadget_ids', None)
    migrated.pop('star_power_ids', None)
    migrated.pop('hyper_charge_ids', None)
    migrated.pop('gear_ids', None)

    return migrated


def migrate_player(player: dict) -> dict:
    """Convert player from old format to raw API format."""
    migrated = rename_fields(player, PLAYER_REVERSE_MAP)

    # Migrate brawlers
    if 'brawlers' in migrated:
        migrated['brawlers'] = [migrate_brawler(b) for b in migrated['brawlers']]

    return migrated


def migrate_club(club: dict) -> dict:
    """Convert club from old format to raw API format."""
    migrated = rename_fields(club, CLUB_REVERSE_MAP)

    # Migrate members
    if 'members' in migrated:
        migrated['members'] = [migrate_player(p) for p in migrated['members']]

    return migrated


def migrate_snapshot(snapshot: dict) -> dict:
    """Convert entire snapshot to raw API format."""
    migrated = {
        'date': snapshot['date'],
        'timestamp': snapshot['timestamp'],
        'clubs': [migrate_club(c) for c in snapshot.get('clubs', [])],
        'individual_players': [migrate_player(p) for p in snapshot.get('individual_players', [])],
    }
    return migrated


def migrate_file(filepath: Path, dry_run: bool = False):
    """Migrate a single snapshot file."""
    print(f"Processing {filepath.name}...", end=" ")

    try:
        data = json.loads(filepath.read_text(encoding='utf-8'))
        migrated = migrate_snapshot(data)

        if not dry_run:
            filepath.write_text(json.dumps(migrated, indent=2, ensure_ascii=False), encoding='utf-8')

        print("✓")
        return True
    except Exception as e:
        print(f"✗ {e}")
        return False


def main():
    dry_run = '--dry-run' in sys.argv

    snapshots_dir = Path(__file__).parent / 'data' / 'snapshots'
    snapshot_files = sorted(snapshots_dir.glob('*.json'))

    # Exclude metadata file
    snapshot_files = [f for f in snapshot_files if f.name != '_last_updated.json']

    print("=" * 60)
    print("SNAPSHOT MIGRATION")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"Files to migrate: {len(snapshot_files)}")
    print()

    if dry_run:
        print("Running in dry-run mode. No files will be modified.")
        print()

    success_count = 0
    for filepath in snapshot_files:
        if migrate_file(filepath, dry_run):
            success_count += 1

    print()
    print("=" * 60)
    print(f"Migrated: {success_count}/{len(snapshot_files)}")
    print("=" * 60)

    if dry_run:
        print("\nTo apply changes, run: python migrate_snapshots.py")


if __name__ == '__main__':
    main()
