#!/usr/bin/env python3
"""
Aggregate raw data into precomputed stats for frontend.

Reads from data/raw/ (compressed snapshots + battlelogs)
Outputs to data/aggregated/ (JSON files ready for frontend lazy loading)
"""

import json
import gzip
from pathlib import Path
from typing import Dict, List, Set, Any, Optional
from datetime import datetime, timezone
from collections import defaultdict, Counter
from dataclasses import dataclass, asdict
import sys

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from src.aggregation.compression import load_compressed


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

        print(f"✓ Player index: {len(data)} players")
        return len(self.errors) == 0

    def validate_club_summary(self, data: Dict) -> bool:
        """Validate club-summary.json structure"""
        required = ['version', 'quick_stats', 'trophy_timeline', 'leaderboards']
        for field in required:
            if field not in data:
                self.errors.append(f"club-summary.json missing '{field}'")

        if 'quick_stats' in data:
            qs = data['quick_stats']
            required_stats = ['total_players', 'total_trophies', 'avg_trophies', 'total_3v3_wins', 'total_brawlers_owned']
            for stat in required_stats:
                if stat not in qs:
                    self.errors.append(f"quick_stats missing '{stat}'")

        if 'trophy_timeline' in data and len(data['trophy_timeline']) > 0:
            first = data['trophy_timeline'][0]
            if 'date' not in first or 'total_trophies' not in first:
                self.errors.append("trophy_timeline entries missing required fields")

        print(f"✓ Club summary: {len(data.get('trophy_timeline', []))} timeline points")
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
            print("\n❌ VALIDATION ERRORS:")
            for err in self.errors:
                print(f"  • {err}")
        if self.warnings:
            print("\n⚠️  WARNINGS:")
            for warn in self.warnings:
                print(f"  • {warn}")

        if not self.errors and not self.warnings:
            print("\n✅ All validations passed")

        return len(self.errors) == 0


@dataclass
class Achievement:
    """Represents a single achievement milestone"""
    date: str  # YYYY-MM-DD
    player_tag: str
    player_name: str
    type: str  # achievement type
    brawler: Optional[str] = None
    item_name: Optional[str] = None
    item_id: Optional[int] = None
    prestige_level: Optional[int] = None
    milestone_value: Optional[int] = None

    def to_dict(self):
        """Convert to dict, excluding None values"""
        return {k: v for k, v in asdict(self).items() if v is not None}


class AchievementHelper:
    """Helper for generating achievements from snapshot comparisons"""

    def __init__(self, brawlers_ref: Dict):
        self.brawlers_ref = brawlers_ref
        self.achievements: List[Achievement] = []
        self.achievement_keys: Set[str] = set()

    def _extract_item_ids(self, items: any) -> Set[int]:
        """Extract item IDs from either format: [id1, id2] or [{id, name}, ...]"""
        if not items:
            return set()
        if isinstance(items, list) and len(items) > 0:
            if isinstance(items[0], dict):
                return {item['id'] for item in items}
            else:
                return set(items)
        return set()

    def _get_item_name(self, item_id: int, item_type: str) -> Optional[str]:
        """Resolve item name from ID using brawlers.json"""
        for brawler_data in self.brawlers_ref.get('items', []):
            if item_type == 'gadget':
                for gadget in brawler_data.get('gadgets', []):
                    if gadget['id'] == item_id:
                        return gadget['name']
            elif item_type == 'star_power':
                for sp in brawler_data.get('starPowers', []):
                    if sp['id'] == item_id:
                        return sp['name']
            elif item_type == 'hypercharge':
                for hc in brawler_data.get('hyperCharges', []):
                    if hc['id'] == item_id:
                        return hc.get('name', 'Hypercharge')
        return None

    def _is_brawler_maxed(self, brawler: Dict) -> bool:
        """Check if brawler is fully maxed (P11 + 2 gadgets + 2 star powers + hypercharge)"""
        gadgets = self._extract_item_ids(brawler.get('gadgets') or brawler.get('gadget_ids'))
        sps = self._extract_item_ids(brawler.get('starPowers') or brawler.get('star_power_ids'))
        hcs = self._extract_item_ids(brawler.get('hyperCharges') or brawler.get('hyper_charge_ids'))

        return (
            brawler.get('power') == 11 and
            len(gadgets) >= 2 and
            len(sps) >= 2 and
            len(hcs) >= 1
        )

    def _get_prestige_level(self, trophies: int) -> int:
        """Calculate prestige level from trophy count"""
        if trophies < 1000:
            return 0
        return trophies // 1000

    def _create_achievement_key(self, achievement: Achievement) -> str:
        """Create unique key for deduplication"""
        key_parts = [achievement.player_tag, achievement.type]
        if achievement.brawler is not None:
            key_parts.append(achievement.brawler)
        if achievement.item_id is not None:
            key_parts.append(str(achievement.item_id))
        if achievement.prestige_level is not None:
            key_parts.append(str(achievement.prestige_level))
        if achievement.milestone_value is not None:
            key_parts.append(str(achievement.milestone_value))
        return "|".join(key_parts)

    def _add_achievement(self, achievement: Achievement) -> bool:
        """Add achievement if doesn't exist. Returns True if added."""
        key = self._create_achievement_key(achievement)
        if key in self.achievement_keys:
            return False
        self.achievement_keys.add(key)
        self.achievements.append(achievement)
        return True

    def _get_all_players(self, snapshot: Dict) -> List[Dict]:
        """Extract all players from snapshot"""
        players = []
        for club in snapshot.get('clubs', []):
            players.extend(club.get('members', []))
        players.extend(snapshot.get('individual_players', []))
        return players

    def compare_snapshots(self, date: str, prev_snapshot: Dict, curr_snapshot: Dict) -> int:
        """Compare two snapshots and detect achievements. Returns count of new achievements found."""
        prev_players = {p['tag']: p for p in self._get_all_players(prev_snapshot)}
        curr_players = {p['tag']: p for p in self._get_all_players(curr_snapshot)}

        new_count = 0

        for tag, curr_player in curr_players.items():
            prev_player = prev_players.get(tag)
            if not prev_player:
                continue

            player_name = curr_player['name']

            # Build brawler lookups
            prev_brawlers = {b['name']: b for b in prev_player.get('brawlers', [])}
            curr_brawlers = {b['name']: b for b in curr_player.get('brawlers', [])}

            # Detect new brawlers
            new_brawler_names = set(curr_brawlers.keys()) - set(prev_brawlers.keys())
            for brawler_name in new_brawler_names:
                if self._add_achievement(Achievement(
                    date=date,
                    player_tag=tag,
                    player_name=player_name,
                    type="new_brawler",
                    brawler=brawler_name
                )):
                    new_count += 1

            # Compare existing brawlers
            for brawler_name, curr_brawler in curr_brawlers.items():
                prev_brawler = prev_brawlers.get(brawler_name)

                # Check if became maxed (only for existing brawlers)
                if prev_brawler:
                    if not self._is_brawler_maxed(prev_brawler) and self._is_brawler_maxed(curr_brawler):
                        if self._add_achievement(Achievement(
                            date=date,
                            player_tag=tag,
                            player_name=player_name,
                            type="maxed_brawler",
                            brawler=brawler_name
                        )):
                            new_count += 1

                # Check new items (including on new brawlers)
                prev_gadgets = self._extract_item_ids(prev_brawler.get('gadgets') or prev_brawler.get('gadget_ids')) if prev_brawler else set()
                curr_gadgets = self._extract_item_ids(curr_brawler.get('gadgets') or curr_brawler.get('gadget_ids'))
                for gadget_id in curr_gadgets - prev_gadgets:
                    item_name = self._get_item_name(gadget_id, 'gadget')
                    if self._add_achievement(Achievement(
                        date=date,
                        player_tag=tag,
                        player_name=player_name,
                        type="gadget",
                        brawler=brawler_name,
                        item_name=item_name,
                        item_id=gadget_id
                    )):
                        new_count += 1

                prev_sps = self._extract_item_ids(prev_brawler.get('starPowers') or prev_brawler.get('star_power_ids')) if prev_brawler else set()
                curr_sps = self._extract_item_ids(curr_brawler.get('starPowers') or curr_brawler.get('star_power_ids'))
                for sp_id in curr_sps - prev_sps:
                    item_name = self._get_item_name(sp_id, 'star_power')
                    if self._add_achievement(Achievement(
                        date=date,
                        player_tag=tag,
                        player_name=player_name,
                        type="star_power",
                        brawler=brawler_name,
                        item_name=item_name,
                        item_id=sp_id
                    )):
                        new_count += 1

                prev_hcs = self._extract_item_ids(prev_brawler.get('hyperCharges') or prev_brawler.get('hyper_charge_ids')) if prev_brawler else set()
                curr_hcs = self._extract_item_ids(curr_brawler.get('hyperCharges') or curr_brawler.get('hyper_charge_ids'))
                for hc_id in curr_hcs - prev_hcs:
                    item_name = self._get_item_name(hc_id, 'hypercharge')
                    if self._add_achievement(Achievement(
                        date=date,
                        player_tag=tag,
                        player_name=player_name,
                        type="hypercharge",
                        brawler=brawler_name,
                        item_name=item_name,
                        item_id=hc_id
                    )):
                        new_count += 1

                # Prestige milestones (only for existing brawlers)
                if prev_brawler:
                    prev_prestige = self._get_prestige_level(prev_brawler.get('trophies', 0))
                    curr_prestige = self._get_prestige_level(curr_brawler.get('trophies', 0))

                    for prestige_level in range(prev_prestige + 1, curr_prestige + 1):
                        if self._add_achievement(Achievement(
                            date=date,
                            player_tag=tag,
                            player_name=player_name,
                            type="prestige",
                            brawler=brawler_name,
                            prestige_level=prestige_level
                        )):
                            new_count += 1

            # Account-level achievements

            # Trophy milestones (every 10k)
            prev_trophies = prev_player.get('trophies', 0)
            curr_trophies = curr_player.get('trophies', 0)
            prev_milestone = (prev_trophies // 10000) * 10000
            curr_milestone = (curr_trophies // 10000) * 10000

            for milestone in range(prev_milestone + 10000, curr_milestone + 10000, 10000):
                if milestone > 0:
                    if self._add_achievement(Achievement(
                        date=date,
                        player_tag=tag,
                        player_name=player_name,
                        type="trophy_milestone",
                        milestone_value=milestone
                    )):
                        new_count += 1

            # First prestige level achievements (P2, P3, P4, P5+)
            prev_prestige_counts = {}
            curr_prestige_counts = {}

            for brawler in prev_player.get('brawlers', []):
                prestige = self._get_prestige_level(brawler.get('trophies', 0))
                if prestige > 0:
                    prev_prestige_counts[prestige] = prev_prestige_counts.get(prestige, 0) + 1

            for brawler in curr_player.get('brawlers', []):
                prestige = self._get_prestige_level(brawler.get('trophies', 0))
                if prestige > 0:
                    curr_prestige_counts[prestige] = curr_prestige_counts.get(prestige, 0) + 1

            # Check for first time reaching each prestige level (P2+)
            for prestige_level in range(2, 8):  # P2 through P7
                if curr_prestige_counts.get(prestige_level, 0) > 0 and prev_prestige_counts.get(prestige_level, 0) == 0:
                    if self._add_achievement(Achievement(
                        date=date,
                        player_tag=tag,
                        player_name=player_name,
                        type="first_prestige_level",
                        prestige_level=prestige_level
                    )):
                        new_count += 1

            # Total prestige milestones (every 10 prestiges)
            prev_total_prestiges = sum(self._get_prestige_level(b.get('trophies', 0)) for b in prev_player.get('brawlers', []))
            curr_total_prestiges = sum(self._get_prestige_level(b.get('trophies', 0)) for b in curr_player.get('brawlers', []))

            prev_prestige_milestone = (prev_total_prestiges // 10) * 10
            curr_prestige_milestone = (curr_total_prestiges // 10) * 10

            for milestone in range(prev_prestige_milestone + 10, curr_prestige_milestone + 10, 10):
                if milestone > 0:
                    if self._add_achievement(Achievement(
                        date=date,
                        player_tag=tag,
                        player_name=player_name,
                        type="total_prestiges",
                        milestone_value=milestone
                    )):
                        new_count += 1

        return new_count


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
            print(f"⚠️  Brawlers reference not found at {path}")
            return {}
        return load_compressed(path)

    def _get_all_snapshot_files(self) -> List[Path]:
        """Get sorted list of snapshot files"""
        snapshots_dir = self.raw_dir / "snapshots"
        files = sorted(snapshots_dir.glob("????-??-??.json.gz"))
        return files

    def _load_snapshot(self, date: str) -> Optional[Dict]:
        """Load snapshot by date (cached)"""
        if date in self.snapshots_cache:
            return self.snapshots_cache[date]

        path = self.raw_dir / "snapshots" / f"{date}.json.gz"
        if not path.exists():
            return None

        data = load_compressed(path)
        self.snapshots_cache[date] = data
        return data

    def _load_latest_snapshot(self) -> Dict:
        """Load most recent snapshot"""
        files = self._get_all_snapshot_files()
        if not files:
            raise FileNotFoundError("No snapshots found")
        return load_compressed(files[-1])

    def _get_all_players(self, snapshot: Dict) -> List[Dict]:
        """Extract all players from snapshot"""
        players = []
        for club in snapshot.get('clubs', []):
            players.extend(club.get('members', []))
        players.extend(snapshot.get('individual_players', []))
        return players

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

    def _save_json(self, data: Any, filepath: Path):
        """Save JSON with pretty formatting"""
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def build_player_index(self) -> Dict[str, Dict]:
        """Generate indexes/players.json - {tag: {name}}"""
        print("\n📊 Building player index...")

        latest = self._load_latest_snapshot()
        players = self._get_all_players(latest)

        index = {}
        for p in players:
            index[p['tag']] = {'name': p['name']}

        self.validator.validate_player_index(index)
        return index

    def generate_club_summary(self, player_index: Dict) -> Dict:
        """Generate club-summary.json (Overview tab data)"""
        print("\n📊 Generating club summary...")

        latest = self._load_latest_snapshot()
        players = self._get_all_players(latest)

        # Quick stats
        total_trophies = sum(p.get('trophies', 0) for p in players)
        total_3v3 = sum(p.get('3vs3Victories', 0) for p in players)
        total_brawlers = sum(len(p.get('brawlers', [])) for p in players)

        quick_stats = {
            'total_players': len(players),
            'total_trophies': total_trophies,
            'avg_trophies': int(total_trophies / len(players)) if players else 0,
            'total_3v3_wins': total_3v3,
            'total_brawlers_owned': total_brawlers
        }

        # Trophy timeline - all snapshot dates
        print("  Building trophy timeline...")
        timeline = []
        snapshot_files = self._get_all_snapshot_files()

        for snap_file in snapshot_files:
            date = snap_file.name.replace('.json.gz', '')  # YYYY-MM-DD
            snapshot = load_compressed(snap_file)
            players_snap = self._get_all_players(snapshot)

            total = sum(p.get('trophies', 0) for p in players_snap)
            timeline.append({
                'date': date,
                'total_trophies': total,
                'player_count': len(players_snap)
            })

        # Leaderboards (using latest snapshot)
        print("  Calculating leaderboards...")
        leaderboards = self._calculate_leaderboards(players)

        summary = {
            'version': 1,
            'generated_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            'quick_stats': quick_stats,
            'trophy_timeline': timeline,
            'leaderboards': leaderboards
        }

        self.validator.validate_club_summary(summary)
        return summary

    def _calculate_leaderboards(self, players: List[Dict]) -> Dict:
        """Calculate all leaderboards from player list"""

        # Helper: sort with tiebreak by name
        def sort_players(players_list, key_func, reverse=True):
            return sorted(players_list,
                         key=lambda p: (key_func(p), p['name']),
                         reverse=reverse)

        # Trophies
        trophies_lb = sort_players(players, lambda p: p.get('trophies', 0))

        # 3v3 Wins
        wins_lb = sort_players(players, lambda p: p.get('3vs3Victories', 0))

        # Solo Wins
        solo_lb = sort_players(players, lambda p: p.get('soloVictories', 0))

        # Duo Wins
        duo_lb = sort_players(players, lambda p: p.get('duoVictories', 0))

        # Brawlers Owned
        brawlers_lb = sort_players(players, lambda p: len(p.get('brawlers', [])))

        # Total Prestiges
        def total_prestiges(p):
            total = 0
            for b in p.get('brawlers', []):
                trophies = b.get('trophies', 0)
                if trophies >= 1000:
                    total += trophies // 1000
            return total

        prestiges_lb = sort_players(players, total_prestiges)

        # Highest Brawler Trophies
        def highest_brawler_trophies(p):
            brawlers = p.get('brawlers', [])
            if not brawlers:
                return 0
            return max(b.get('trophies', 0) for b in brawlers)

        highest_lb = sort_players(players, highest_brawler_trophies)

        # Conditional leaderboards (2k+, 3k+)
        players_2k = [p for p in players if any(b.get('trophies', 0) >= 2000 for b in p.get('brawlers', []))]
        players_3k = [p for p in players if any(b.get('trophies', 0) >= 3000 for b in p.get('brawlers', []))]

        def count_2k_brawlers(p):
            return sum(1 for b in p.get('brawlers', []) if b.get('trophies', 0) >= 2000)

        def count_3k_brawlers(p):
            return sum(1 for b in p.get('brawlers', []) if b.get('trophies', 0) >= 3000)

        brawlers_2k_lb = sort_players(players_2k, count_2k_brawlers) if players_2k else []
        brawlers_3k_lb = sort_players(players_3k, count_3k_brawlers) if players_3k else []

        # Format leaderboards (top 10 with rank)
        def format_lb(players_list, value_key):
            return [
                {
                    'rank': i + 1,
                    'tag': p['tag'],
                    'value': value_key(p)
                }
                for i, p in enumerate(players_list[:10])
            ]

        return {
            'trophies': format_lb(trophies_lb, lambda p: p.get('trophies', 0)),
            'wins_3v3': format_lb(wins_lb, lambda p: p.get('3vs3Victories', 0)),
            'wins_solo': format_lb(solo_lb, lambda p: p.get('soloVictories', 0)),
            'wins_duo': format_lb(duo_lb, lambda p: p.get('duoVictories', 0)),
            'brawlers_owned': format_lb(brawlers_lb, lambda p: len(p.get('brawlers', []))),
            'total_prestiges': format_lb(prestiges_lb, total_prestiges),
            'highest_brawler': format_lb(highest_lb, highest_brawler_trophies),
            'brawlers_2k_plus': format_lb(brawlers_2k_lb, count_2k_brawlers),
            'brawlers_3k_plus': format_lb(brawlers_3k_lb, count_3k_brawlers)
        }

    def generate_player_stats(self, tag: str, latest_snapshot: Dict) -> Dict:
        """Generate players/{TAG}/stats.json"""
        players = self._get_all_players(latest_snapshot)
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

        self.validator.validate_player_stats(tag, stats)
        return stats

    def generate_player_timeline(self, tag: str) -> Dict:
        """Generate players/{TAG}/timeline.json"""
        timeline_data = {
            'trophy_progression': [],
            'mode_distribution': []
        }

        # Trophy progression - iterate all snapshots
        snapshot_files = self._get_all_snapshot_files()
        for snap_file in snapshot_files:
            # Get date from filename (remove .json.gz)
            date = snap_file.name.replace('.json.gz', '')
            snapshot = load_compressed(snap_file)
            players = self._get_all_players(snapshot)
            player = next((p for p in players if p['tag'] == tag), None)

            if player:
                timeline_data['trophy_progression'].append({
                    'date': date,
                    'trophies': player.get('trophies', 0)
                })

        # Mode distribution from battlelogs
        battles = self._load_battlelog(tag)
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

    def generate_player_battle_stats(self, tag: str) -> Dict:
        """Generate players/{TAG}/battle-stats.json"""
        battles = self._load_battlelog(tag)

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

    def generate_player_brawlers(self, tag: str, latest_snapshot: Dict) -> Dict:
        """Generate players/{TAG}/brawlers.json - detailed brawler table"""
        players = self._get_all_players(latest_snapshot)
        player = next((p for p in players if p['tag'] == tag), None)

        if not player:
            return {'brawlers': []}

        brawlers_data = []
        all_brawler_ids = {b['id'] for b in self.brawlers_ref.get('items', [])}

        # Owned brawlers
        for brawler in player.get('brawlers', []):
            brawler_id = brawler.get('id')
            name = brawler.get('name')
            power = brawler.get('power', 0)
            trophies = brawler.get('trophies', 0)
            rank = brawler.get('rank', 0)

            # Extract items
            gadgets = self._extract_item_ids(brawler.get('gadgets'))
            star_powers = self._extract_item_ids(brawler.get('starPowers'))
            hypercharges = self._extract_item_ids(brawler.get('hyperCharges'))
            gears = self._extract_item_ids(brawler.get('gears'))

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
        for brawler_ref in self.brawlers_ref.get('items', []):
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

    def generate_achievements(self):
        """Generate achievements by comparing compressed snapshots"""
        print("\n📊 Generating achievements...")

        # Get all compressed snapshots sorted by date
        snapshot_files = self._get_all_snapshot_files()

        if len(snapshot_files) < 2:
            print("  ⚠️  Need at least 2 snapshots to compare")
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
            count = helper.compare_snapshots(prev_date, prev_snapshot, curr_snapshot)
            total_new += count

        # Save to aggregated output
        dest = self.agg_dir / "achievements.json"
        achievements_data = [a.to_dict() for a in helper.achievements]
        achievements_data.sort(key=lambda x: x['date'])

        with open(dest, 'w', encoding='utf-8') as f:
            json.dump(achievements_data, f, indent=2, ensure_ascii=False)

        size_kb = dest.stat().st_size / 1024
        print(f"  ✓ Generated {len(achievements_data)} achievements ({size_kb:.1f} KB)")
        return True

    def generate_battles(self):
        """Generate deduplicated 7-day battle segments"""
        print("\n📊 Generating battle segments...")

        # Build player index from latest snapshot
        snapshot = self._load_latest_snapshot()
        player_index = {p['tag']: p['name'] for p in self._get_all_players(snapshot)}

        # Collect all battles from all players
        all_battles = []

        for tag in player_index.keys():
            battles = self._load_battlelog(tag)
            all_battles.extend(battles)

        print(f"  Loaded {len(all_battles)} total battles from {len(player_index)} players")

        # Deduplicate by battleTime + event.id
        seen_keys = {}
        deduplicated = []

        for battle in all_battles:
            battle_time = battle.get('battleTime')
            event_id = battle.get('event', {}).get('id')

            if not battle_time or not event_id:
                continue

            key = f"{battle_time}|{event_id}"

            if key not in seen_keys:
                seen_keys[key] = True
                deduplicated.append(battle)

        print(f"  Deduplicated: {len(all_battles)} → {len(deduplicated)} battles ({len(all_battles) - len(deduplicated)} removed)")

        # Sort by battleTime descending (newest first)
        deduplicated.sort(key=lambda b: b.get('battleTime', ''), reverse=True)

        # Segment into 7-day buckets
        from datetime import timedelta

        now = datetime.now(timezone.utc)
        segments = {
            'recent': [],  # Last 7 days
            'week2': [],   # 8-14 days ago
            'week3': [],   # 15-21 days ago
            'week4': [],   # 22-28 days ago
            'older': []    # 29+ days ago
        }

        for battle in deduplicated:
            battle_time_str = battle.get('battleTime', '')
            try:
                # Parse API timestamp: "20260826T134521.000Z"
                battle_time = datetime.strptime(battle_time_str, '%Y%m%dT%H%M%S.%fZ').replace(tzinfo=timezone.utc)
                days_ago = (now - battle_time).days

                if days_ago < 7:
                    segments['recent'].append(battle)
                elif days_ago < 14:
                    segments['week2'].append(battle)
                elif days_ago < 21:
                    segments['week3'].append(battle)
                elif days_ago < 28:
                    segments['week4'].append(battle)
                else:
                    segments['older'].append(battle)
            except:
                # If parsing fails, put in older
                segments['older'].append(battle)

        # Save segments with predictable filenames
        battles_dir = self.agg_dir / "battles"

        self._save_json(segments['recent'], battles_dir / "recent.json")
        print(f"  ✓ recent.json: {len(segments['recent'])} battles")

        if segments['week2']:
            self._save_json(segments['week2'], battles_dir / "week-2.json")
            print(f"  ✓ week-2.json: {len(segments['week2'])} battles")

        if segments['week3']:
            self._save_json(segments['week3'], battles_dir / "week-3.json")
            print(f"  ✓ week-3.json: {len(segments['week3'])} battles")

        if segments['week4']:
            self._save_json(segments['week4'], battles_dir / "week-4.json")
            print(f"  ✓ week-4.json: {len(segments['week4'])} battles")

        if segments['older']:
            self._save_json(segments['older'], battles_dir / "older.json")
            print(f"  ✓ older.json: {len(segments['older'])} battles")

    def generate_all(self):
        """Main entry point - generate all aggregated files"""
        print("=" * 60)
        print("AGGREGATING DATA")
        print("=" * 60)

        # 1. Player index
        player_index = self.build_player_index()
        self._save_json(player_index, self.agg_dir / "indexes" / "players.json")

        # 2. Club summary
        club_summary = self.generate_club_summary(player_index)
        self._save_json(club_summary, self.agg_dir / "club-summary.json")

        # 3. Per-player files
        print(f"\n📊 Generating player data for {len(player_index)} players...")
        latest = self._load_latest_snapshot()

        for i, tag in enumerate(player_index.keys(), 1):
            tag_clean = tag.replace('#', '')
            player_dir = self.agg_dir / "players" / tag_clean

            # stats.json
            stats = self.generate_player_stats(tag, latest)
            if stats:
                self._save_json(stats, player_dir / "stats.json")

            # timeline.json
            timeline = self.generate_player_timeline(tag)
            self._save_json(timeline, player_dir / "timeline.json")

            # battle-stats.json
            battle_stats = self.generate_player_battle_stats(tag)
            self._save_json(battle_stats, player_dir / "battle-stats.json")

            # brawlers.json
            brawlers = self.generate_player_brawlers(tag, latest)
            self._save_json(brawlers, player_dir / "brawlers.json")

            if i % 5 == 0:
                print(f"  Progress: {i}/{len(player_index)}")

        # 4. Achievements (generated from snapshots)
        self.generate_achievements()

        # 5. Battles (deduplicated segments)
        self.generate_battles()

        # Validation report
        print("\n" + "=" * 60)
        print("VALIDATION")
        print("=" * 60)
        success = self.validator.report()

        if success:
            # Calculate output size
            total_size = sum(f.stat().st_size for f in self.agg_dir.rglob('*.json'))
            print(f"\n📦 Total output size: {total_size / 1024:.1f} KB")

        return success


def main():
    aggregator = Aggregator()
    success = aggregator.generate_all()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
