"""
Achievement generation from snapshot comparisons.

Detects player milestones by comparing consecutive daily snapshots.
"""

from dataclasses import dataclass, asdict
from typing import Dict, List, Set, Optional


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
