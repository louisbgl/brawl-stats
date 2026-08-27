#!/usr/bin/env python3
"""
Aggregate raw data into precomputed stats for frontend.

Reads from data/raw/ (compressed snapshots + battlelogs)
Outputs to data/aggregated/ (JSON files ready for frontend lazy loading)
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Set, Any, Optional
from datetime import datetime, timezone

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.aggregation.compression import load_compressed
from src.aggregation.achievements import AchievementHelper, Achievement
from src.aggregation.club_stats import generate_club_summary
from src.aggregation.player_stats import (
    generate_player_stats,
    generate_player_timeline,
    generate_player_battle_stats,
    generate_player_brawlers
)
from src.aggregation.battles import generate_battle_segments


class Validator:
    """Validates aggregated output against DATA_FLOW spec"""

    def __init__(self):
        self.errors = []
        self.warnings = []

    def validate_player_index(self, data: Dict) -> bool:
        """Validate indexes/players.json structure"""
        if not isinstance(data, dict):
            self.errors.append("players.json must be dict")
            return False

        for tag, info in data.items():
            if not tag.startswith('#'):
                self.errors.append(f"Invalid tag format: {tag}")
            if 'name' not in info:
                self.errors.append(f"Missing name for {tag}")

        print(f"Player index: {len(data)} players")
        return len(self.errors) == 0

    def validate_club_summary(self, data: Dict) -> bool:
        """Validate club-summary.json structure"""
        required = ['version', 'quick_stats', 'trophy_timeline', 'leaderboards']
        for field in required:
            if field not in data:
                self.errors.append(f"club-summary.json missing '{field}'")

        if 'quick_stats' in data:
            qs = data['quick_stats']
            required_stats = ['total_members', 'total_trophies', 'total_battles', 'avg_winrate', 'fav_mode']
            for stat in required_stats:
                if stat not in qs:
                    self.errors.append(f"quick_stats missing '{stat}'")

        if 'trophy_timeline' in data and len(data['trophy_timeline']) > 0:
            first = data['trophy_timeline'][0]
            if 'date' not in first or 'players' not in first:
                self.errors.append("trophy_timeline entries missing required fields (need 'date' and 'players')")

        if 'leaderboards' in data:
            lb = data['leaderboards']
            required_lbs = ['trophies', 'ranked_best', 'winrate', 'total_battles', 'maxed_brawlers', 'brawlers_1k']
            for lb_name in required_lbs:
                if lb_name not in lb:
                    self.errors.append(f"leaderboards missing '{lb_name}'")

        print(f"Club summary: {len(data.get('trophy_timeline', []))} timeline points")
        return len(self.errors) == 0

    def validate_player_stats(self, tag: str, data: Dict) -> bool:
        """Validate players/{TAG}/stats.json"""
        required = ['quick_stats', 'prestige_distribution', 'power_distribution']
        for field in required:
            if field not in data:
                self.errors.append(f"{tag} stats.json missing '{field}'")

        return len(self.errors) == 0

    def report(self):
        """Print validation results"""
        if self.errors:
            print("\nVALIDATION ERRORS:")
            for err in self.errors:
                print(f"  • {err}")
        if self.warnings:
            print("\nWARNINGS:")
            for warn in self.warnings:
                print(f"  • {warn}")

        if not self.errors and not self.warnings:
            print("\nAll validations passed")

        return len(self.errors) == 0


class Aggregator:
    """Generate aggregated stats from raw data"""

    def __init__(self, raw_dir: Path = Path("data/raw"), agg_dir: Path = Path("data/aggregated")):
        self.raw_dir = raw_dir
        self.agg_dir = agg_dir
        self.validator = Validator()

        # Load reference data
        self.brawlers_ref = self._load_brawlers_ref()

        # Cache for loaded data
        self.snapshots_cache = {}
        self.battlelogs_cache = {}

    def _load_brawlers_ref(self) -> Dict:
        """Load brawlers.json.gz from raw"""
        path = self.raw_dir / "brawlers.json.gz"
        if not path.exists():
            print(f"Brawlers reference not found at {path}")
            return {}
        return load_compressed(path)

    def _get_all_snapshot_files(self) -> List[Path]:
        """Get sorted list of snapshot files"""
        snapshots_dir = self.raw_dir / "snapshots"
        files = sorted(snapshots_dir.glob("????-??-??.json.gz"))
        return files

    def _load_snapshot(self, date: str) -> Optional[Dict]:
        """Load snapshot by date (cached). Use 'latest' for most recent."""
        if date == 'latest':
            files = self._get_all_snapshot_files()
            if not files:
                raise FileNotFoundError("No snapshots found")
            return load_compressed(files[-1])

        if date in self.snapshots_cache:
            return self.snapshots_cache[date]

        path = self.raw_dir / "snapshots" / f"{date}.json.gz"
        if not path.exists():
            return None

        data = load_compressed(path)
        self.snapshots_cache[date] = data
        return data

    def _load_battlelog(self, tag: str) -> List[Dict]:
        """Load battlelog for player (cached)"""
        if tag in self.battlelogs_cache:
            return self.battlelogs_cache[tag]

        # Remove # from tag for filename
        tag_clean = tag.replace('#', '')
        path = self.raw_dir / "battlelogs" / f"{tag_clean}.json.gz"

        if not path.exists():
            return []

        battles = load_compressed(path)
        self.battlelogs_cache[tag] = battles
        return battles

    def _extract_item_ids(self, items: Any) -> Set[int]:
        """Extract item IDs from either format: [id1, id2] or [{id, name}, ...]"""
        if not items:
            return set()
        if isinstance(items, list) and len(items) > 0:
            if isinstance(items[0], dict):
                return {item['id'] for item in items}
            else:
                return set(items)
        return set()

    def _get_all_players(self, snapshot: Dict) -> List[Dict]:
        """Extract all players from snapshot"""
        players = []
        for club in snapshot.get('clubs', []):
            players.extend(club.get('members', []))
        players.extend(snapshot.get('individual_players', []))
        return players

    def _save_json(self, data: Any, filepath: Path):
        """Save JSON with pretty formatting"""
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def build_player_index(self) -> Dict[str, Dict]:
        """Generate indexes/players.json - {tag: {name}}"""
        print("\nBuilding player index...")

        latest = self._load_snapshot('latest')
        players = self._get_all_players(latest)

        index = {}
        for p in players:
            index[p['tag']] = {'name': p['name']}

        self.validator.validate_player_index(index)
        return index

    def generate_metadata(self) -> Dict:
        """Generate metadata.json - global data like freshness indicators"""
        print("\nGenerating metadata...")

        snapshot_files = self._get_all_snapshot_files()

        # First snapshot date
        first_snapshot_date = snapshot_files[0].name.replace('.json.gz', '')

        # Load collection metadata from raw/metadata/snapshots.json
        snapshot_meta_path = self.raw_dir / "metadata" / "snapshots.json"
        snapshot_timestamp = None
        if snapshot_meta_path.exists():
            with open(snapshot_meta_path) as f:
                snapshot_meta = json.load(f)
                snapshot_timestamp = snapshot_meta.get('timestamp')

        # Fallback: use latest snapshot date at midnight
        if not snapshot_timestamp:
            latest_snapshot_date = snapshot_files[-1].name.replace('.json.gz', '')
            snapshot_timestamp = datetime.strptime(latest_snapshot_date, '%Y-%m-%d').replace(tzinfo=timezone.utc).isoformat()

        # Load metadata/battlelogs.json for battlelog timestamp
        battlelog_meta_path = self.raw_dir / "metadata" / "battlelogs.json"
        battlelog_timestamp = None
        if battlelog_meta_path.exists():
            with open(battlelog_meta_path) as f:
                battlelog_meta = json.load(f)
                battlelog_timestamp = battlelog_meta.get('last_collection')

        # Fallback: scan battlelogs for most recent battle
        if not battlelog_timestamp:
            latest = self._load_snapshot('latest')
            players = self._get_all_players(latest)
            latest_battle_time = None
            for player in players:
                battles = self._load_battlelog(player['tag'])
                if battles:
                    battle_time_str = battles[-1].get('battleTime', '')
                    if battle_time_str:
                        try:
                            battle_time = datetime.strptime(battle_time_str, '%Y%m%dT%H%M%S.%fZ').replace(tzinfo=timezone.utc)
                            if latest_battle_time is None or battle_time > latest_battle_time:
                                latest_battle_time = battle_time
                        except:
                            pass
            if latest_battle_time:
                battlelog_timestamp = latest_battle_time.isoformat().replace('+00:00', 'Z')

        metadata = {
            'version': 1,
            'generated_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            'tracking_since': first_snapshot_date,
            'data_freshness': {
                'snapshot': snapshot_timestamp,
                'battlelog': battlelog_timestamp
            }
        }

        print(f"Metadata: tracking since {first_snapshot_date}")
        return metadata

    def generate_achievements_data(self):
        """Generate achievements by comparing compressed snapshots"""
        print("\nGenerating achievements...")

        # Get all compressed snapshots sorted by date
        snapshot_files = self._get_all_snapshot_files()

        if len(snapshot_files) < 2:
            print("Need at least 2 snapshots to compare")
            return False

        print(f"  Found {len(snapshot_files)} snapshots")

        # Initialize helper
        helper = AchievementHelper(self.brawlers_ref)

        # Compare consecutive snapshots
        total_new = 0
        for i in range(1, len(snapshot_files)):
            prev_date = snapshot_files[i - 1].name.replace('.json.gz', '')
            curr_date = snapshot_files[i].name.replace('.json.gz', '')

            prev_snapshot = load_compressed(snapshot_files[i - 1])
            curr_snapshot = load_compressed(snapshot_files[i])

            if not prev_snapshot or not curr_snapshot:
                continue

            # Generate achievements for this date pair
            count = helper.compare_snapshots(curr_date, prev_snapshot, curr_snapshot)
            total_new += count

        # Save to aggregated output
        dest = self.agg_dir / "achievements.json"
        achievements_data = [a.to_dict() for a in helper.achievements]
        achievements_data.sort(key=lambda x: x['date'])

        with open(dest, 'w', encoding='utf-8') as f:
            json.dump(achievements_data, f, indent=2, ensure_ascii=False)

        size_kb = dest.stat().st_size / 1024
        print(f"Generated {len(achievements_data)} achievements ({size_kb:.1f} KB)")
        return True

    def generate_all(self):
        """Main entry point - generate all aggregated files"""
        print("=" * 60)
        print("AGGREGATING DATA")
        print("=" * 60)

        # 1. Metadata (global header data)
        metadata = self.generate_metadata()
        self._save_json(metadata, self.agg_dir / "metadata.json")

        # 2. Player index
        player_index = self.build_player_index()
        self._save_json(player_index, self.agg_dir / "indexes" / "players.json")

        # 3. Club summary
        club_summary = generate_club_summary(
            self.raw_dir,
            player_index,
            self._load_snapshot,
            self._load_battlelog,
            self._extract_item_ids
        )
        self.validator.validate_club_summary(club_summary)
        self._save_json(club_summary, self.agg_dir / "club-summary.json")

        # 4. Per-player files
        print(f"\n[*] Generating player data for {len(player_index)} players...")
        latest = self._load_snapshot('latest')
        snapshot_files = self._get_all_snapshot_files()

        for i, tag in enumerate(player_index.keys(), 1):
            tag_clean = tag.replace('#', '')
            player_dir = self.agg_dir / "players" / tag_clean

            # stats.json
            stats = generate_player_stats(tag, latest, self._get_all_players, self._extract_item_ids)
            if stats:
                self.validator.validate_player_stats(tag, stats)
                self._save_json(stats, player_dir / "stats.json")

            # timeline.json
            timeline = generate_player_timeline(tag, snapshot_files, self._load_snapshot, self._load_battlelog, self._get_all_players)
            self._save_json(timeline, player_dir / "timeline.json")

            # battle-stats.json
            battle_stats = generate_player_battle_stats(tag, self._load_battlelog)
            self._save_json(battle_stats, player_dir / "battle-stats.json")

            # brawlers.json
            brawlers = generate_player_brawlers(tag, latest, self.brawlers_ref, self._get_all_players, self._extract_item_ids)
            self._save_json(brawlers, player_dir / "brawlers.json")

            if i % 5 == 0:
                print(f"  Progress: {i}/{len(player_index)}")

        # 5. Achievements (generated from snapshots)
        self.generate_achievements_data()

        # 6. Battles (deduplicated segments with flat format)
        generate_battle_segments(
            self.raw_dir,
            self.agg_dir,
            player_index,
            self._load_battlelog
        )

        # Validation report
        print("\n" + "=" * 60)
        print("VALIDATION")
        print("=" * 60)
        success = self.validator.report()

        if success:
            # Calculate output size
            total_size = sum(f.stat().st_size for f in self.agg_dir.rglob('*.json'))
            print(f"\nTotal output size: {total_size / 1024:.1f} KB")

        return success


def main():
    aggregator = Aggregator()
    success = aggregator.generate_all()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
