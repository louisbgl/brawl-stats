#!/usr/bin/env python3
"""
Generate achievements by comparing consecutive daily snapshots.
Achievements include: new brawlers, maxed brawlers, gadgets, star powers, hypercharges, and prestige milestones.
"""

import json
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Set, Dict, Optional
from datetime import datetime


@dataclass
class Achievement:
    """Represents a single achievement milestone"""
    date: str  # YYYY-MM-DD
    player_tag: str
    player_name: str
    type: str  # "new_brawler", "maxed_brawler", "gadget", "star_power", "hypercharge", "prestige"
    brawler: str  # Brawler name
    item_name: Optional[str] = None  # For gadgets/star powers (resolved from brawlers.json)
    item_id: Optional[int] = None  # Store the ID for reference
    prestige_level: Optional[int] = None  # For prestige achievements (1, 2, 3, ...)

    def to_dict(self):
        """Convert to dict for JSON serialization, excluding None values"""
        return {k: v for k, v in asdict(self).items() if v is not None}


class AchievementGenerator:
    """Generates achievements by comparing daily snapshots"""

    def __init__(self, data_dir: Path = Path("data")):
        self.data_dir = data_dir
        self.brawlers_ref = self._load_brawlers_reference()
        self.existing_achievements: List[Achievement] = []
        self.achievement_keys: Set[str] = set()  # For deduplication

    def _load_brawlers_reference(self) -> Dict:
        """Load brawlers.json for item name resolution"""
        brawlers_file = self.data_dir / "brawlers.json"
        if not brawlers_file.exists():
            return {}
        with open(brawlers_file, 'r', encoding='utf-8') as f:
            return json.load(f)

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

    def _load_snapshot(self, date: str) -> Optional[Dict]:
        """Load a daily snapshot by date (YYYY-MM-DD)"""
        snapshot_file = self.data_dir / f"{date}.json"
        if not snapshot_file.exists():
            return None
        with open(snapshot_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _get_all_players(self, snapshot: Dict) -> List[Dict]:
        """Extract all players from a snapshot (club members + individual players)"""
        players = []

        # Club members
        for club in snapshot.get('clubs', []):
            players.extend(club.get('members', []))

        # Individual players
        players.extend(snapshot.get('individual_players', []))

        return players

    def _is_brawler_maxed(self, brawler: Dict) -> bool:
        """Check if a brawler is fully maxed (P11 + 2 gadgets + 2 star powers + hypercharge)"""
        return (
            brawler.get('power') == 11 and
            len(brawler.get('gadget_ids', [])) >= 2 and
            len(brawler.get('star_power_ids', [])) >= 2 and
            len(brawler.get('hyper_charge_ids', [])) >= 1
        )

    def _get_prestige_level(self, trophies: int) -> int:
        """Calculate prestige level from trophy count (1000+ = prestige 1, 2000+ = prestige 2, etc.)"""
        if trophies < 1000:
            return 0
        return trophies // 1000

    def _create_achievement_key(self, achievement: Achievement) -> str:
        """Create a unique key for deduplication"""
        key_parts = [achievement.player_tag, achievement.type, achievement.brawler]
        if achievement.item_id is not None:
            key_parts.append(str(achievement.item_id))
        if achievement.prestige_level is not None:
            key_parts.append(str(achievement.prestige_level))
        return "|".join(key_parts)

    def _add_achievement(self, achievement: Achievement) -> bool:
        """Add achievement if it doesn't already exist. Returns True if added."""
        key = self._create_achievement_key(achievement)
        if key in self.achievement_keys:
            return False
        self.achievement_keys.add(key)
        self.existing_achievements.append(achievement)
        return True

    def compare_snapshots(self, date: str, prev_snapshot: Dict, curr_snapshot: Dict) -> List[Achievement]:
        """Compare two consecutive snapshots and detect achievements"""
        new_achievements = []

        prev_players = {p['tag']: p for p in self._get_all_players(prev_snapshot)}
        curr_players = {p['tag']: p for p in self._get_all_players(curr_snapshot)}

        for tag, curr_player in curr_players.items():
            prev_player = prev_players.get(tag)
            if not prev_player:
                continue  # Skip new players (can't compare)

            player_name = curr_player['name']

            # Build brawler lookup dicts
            prev_brawlers = {b['name']: b for b in prev_player.get('brawlers', [])}
            curr_brawlers = {b['name']: b for b in curr_player.get('brawlers', [])}

            # Detect new brawlers
            new_brawler_names = set(curr_brawlers.keys()) - set(prev_brawlers.keys())
            for brawler_name in new_brawler_names:
                achievement = Achievement(
                    date=date,
                    player_tag=tag,
                    player_name=player_name,
                    type="new_brawler",
                    brawler=brawler_name
                )
                if self._add_achievement(achievement):
                    new_achievements.append(achievement)

            # Compare existing brawlers
            for brawler_name, curr_brawler in curr_brawlers.items():
                prev_brawler = prev_brawlers.get(brawler_name)
                if not prev_brawler:
                    continue  # Already handled as new brawler

                # Check if brawler became maxed
                if not self._is_brawler_maxed(prev_brawler) and self._is_brawler_maxed(curr_brawler):
                    achievement = Achievement(
                        date=date,
                        player_tag=tag,
                        player_name=player_name,
                        type="maxed_brawler",
                        brawler=brawler_name
                    )
                    if self._add_achievement(achievement):
                        new_achievements.append(achievement)

                # Check for new gadgets
                prev_gadgets = set(prev_brawler.get('gadget_ids', []))
                curr_gadgets = set(curr_brawler.get('gadget_ids', []))
                new_gadgets = curr_gadgets - prev_gadgets
                for gadget_id in new_gadgets:
                    item_name = self._get_item_name(gadget_id, 'gadget')
                    achievement = Achievement(
                        date=date,
                        player_tag=tag,
                        player_name=player_name,
                        type="gadget",
                        brawler=brawler_name,
                        item_name=item_name,
                        item_id=gadget_id
                    )
                    if self._add_achievement(achievement):
                        new_achievements.append(achievement)

                # Check for new star powers
                prev_sps = set(prev_brawler.get('star_power_ids', []))
                curr_sps = set(curr_brawler.get('star_power_ids', []))
                new_sps = curr_sps - prev_sps
                for sp_id in new_sps:
                    item_name = self._get_item_name(sp_id, 'star_power')
                    achievement = Achievement(
                        date=date,
                        player_tag=tag,
                        player_name=player_name,
                        type="star_power",
                        brawler=brawler_name,
                        item_name=item_name,
                        item_id=sp_id
                    )
                    if self._add_achievement(achievement):
                        new_achievements.append(achievement)

                # Check for new hypercharges
                prev_hcs = set(prev_brawler.get('hyper_charge_ids', []))
                curr_hcs = set(curr_brawler.get('hyper_charge_ids', []))
                new_hcs = curr_hcs - prev_hcs
                for hc_id in new_hcs:
                    item_name = self._get_item_name(hc_id, 'hypercharge')
                    achievement = Achievement(
                        date=date,
                        player_tag=tag,
                        player_name=player_name,
                        type="hypercharge",
                        brawler=brawler_name,
                        item_name=item_name,
                        item_id=hc_id
                    )
                    if self._add_achievement(achievement):
                        new_achievements.append(achievement)

                # Check for prestige milestones
                prev_prestige = self._get_prestige_level(prev_brawler.get('trophies', 0))
                curr_prestige = self._get_prestige_level(curr_brawler.get('trophies', 0))

                # Award achievement for each prestige level crossed
                for prestige_level in range(prev_prestige + 1, curr_prestige + 1):
                    achievement = Achievement(
                        date=date,
                        player_tag=tag,
                        player_name=player_name,
                        type="prestige",
                        brawler=brawler_name,
                        prestige_level=prestige_level
                    )
                    if self._add_achievement(achievement):
                        new_achievements.append(achievement)

        return new_achievements

    def load_existing_achievements(self):
        """Load existing achievements.json if it exists"""
        achievements_file = self.data_dir / "achievements.json"
        if not achievements_file.exists():
            return

        with open(achievements_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Rebuild achievement keys for deduplication
        for item in data:
            achievement = Achievement(
                date=item['date'],
                player_tag=item['player_tag'],
                player_name=item['player_name'],
                type=item['type'],
                brawler=item['brawler'],
                item_name=item.get('item_name'),
                item_id=item.get('item_id'),
                prestige_level=item.get('prestige_level')
            )
            key = self._create_achievement_key(achievement)
            self.achievement_keys.add(key)
            self.existing_achievements.append(achievement)

        print(f"Loaded {len(self.existing_achievements)} existing achievements")

    def generate_all_achievements(self, force_regenerate: bool = False):
        """Generate achievements from all available snapshots"""
        if not force_regenerate:
            self.load_existing_achievements()

        # Get all snapshot files sorted by date
        snapshot_files = sorted(self.data_dir.glob("????-??-??.json"))

        if len(snapshot_files) < 2:
            print("Need at least 2 snapshots to compare")
            return

        print(f"Found {len(snapshot_files)} snapshots")

        new_count = 0
        for i in range(1, len(snapshot_files)):
            prev_date = snapshot_files[i - 1].stem
            curr_date = snapshot_files[i].stem

            prev_snapshot = self._load_snapshot(prev_date)
            curr_snapshot = self._load_snapshot(curr_date)

            if not prev_snapshot or not curr_snapshot:
                continue

            new_achievements = self.compare_snapshots(curr_date, prev_snapshot, curr_snapshot)
            new_count += len(new_achievements)

            if new_achievements:
                print(f"{curr_date}: Found {len(new_achievements)} new achievements")

        print(f"\nTotal achievements: {len(self.existing_achievements)} ({new_count} new)")

    def save_achievements(self):
        """Save all achievements to achievements.json"""
        achievements_file = self.data_dir / "achievements.json"

        # Convert to dicts and sort by date (oldest first)
        achievements_data = [a.to_dict() for a in self.existing_achievements]
        achievements_data.sort(key=lambda x: x['date'])

        with open(achievements_file, 'w', encoding='utf-8') as f:
            json.dump(achievements_data, f, indent=2, ensure_ascii=False)

        print(f"Saved {len(achievements_data)} achievements to {achievements_file}")


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Generate achievements from daily snapshots")
    parser.add_argument(
        "--force-regenerate",
        action="store_true",
        help="Regenerate all achievements from scratch (ignores existing achievements.json)"
    )
    args = parser.parse_args()

    generator = AchievementGenerator()
    generator.generate_all_achievements(force_regenerate=args.force_regenerate)
    generator.save_achievements()


if __name__ == "__main__":
    main()
