"""
BFS explorer: starting from a seed tag, expand through ranked opponents
and add qualifying players (rankedRank >= 21) to data/ranked/tags.json.

Stops when: max_players added, max_depth reached, OR full tree explored.

Usage:
    uv run testing/explore_ranked_players.py
    uv run testing/explore_ranked_players.py --seed '#ABC123' --max-players 100 --max-depth 5
    uv run testing/explore_ranked_players.py --seed all
"""

import sys
import argparse
from collections import deque
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from testing.api import ApiCaller
from testing.test_api import _series_key, _load_ranked_tags, _save_ranked_tags

MIN_RANK_ADD = 22       # Pro — saved to tags.json
MIN_EXPLORE_RANK = 21   # Masters III — explored for opponents but not saved


def extract_opponents(tag: str, battlelog: dict) -> list[str]:
    """Extract unique opponent tags from a soloRanked battlelog response."""
    if not battlelog or "items" not in battlelog:
        return []
    ranked = [b for b in battlelog["items"] if b.get("battle", {}).get("type") == "soloRanked"]
    seen_series = set()
    opponents = set()
    for b in ranked:
        key = _series_key(b)
        if key in seen_series:
            continue
        seen_series.add(key)
        for team in b.get("battle", {}).get("teams", []):
            for player in team:
                t = player.get("tag")
                if t and t != tag:
                    opponents.add(t)
    return list(opponents)


def explore(seed: str, max_players: int = 50, max_depth: int = 4, rate_limit: int = 150):
    caller = ApiCaller(rate_limit=rate_limit, workers=20)
    tags = _load_ranked_tags()

    # explored: battlelogs fetched this run — never fetch twice
    # disqualified: 404s + below min rank — never check twice
    explored = set()
    disqualified = set()

    queue = deque()

    def enqueue(tag, depth):
        if tag not in explored:
            queue.append((tag, depth))
            explored.add(tag)

    if seed == "all":
        print(f"Seeding from all {len(tags)} known tags in tags.json ...")
        for t in tags:
            enqueue(t, 0)
    else:
        enqueue(seed, 0)

    added = 0

    while queue and added < max_players:
        # Drain current depth level into a batch
        current_depth = queue[0][1]
        batch = []
        while queue and queue[0][1] == current_depth:
            tag, depth = queue.popleft()
            if depth < max_depth:
                batch.append(tag)

        if not batch:
            continue

        print(f"\n[depth={current_depth}] fetching {len(batch)} battlelogs ...")

        # Batch fetch all battlelogs for this depth level
        battlelog_endpoints = [f"players/{t}/battlelog" for t in batch]
        battlelog_results = caller.mass_call(battlelog_endpoints)

        # Collect all unseen opponents across the batch
        all_new_opponents = set()
        for (ep, data), tag in zip(battlelog_results, batch):
            opponents = extract_opponents(tag, data)
            for opp in opponents:
                if opp not in explored and opp not in disqualified:
                    all_new_opponents.add(opp)

        if not all_new_opponents:
            print(f"  no new opponents found")
            continue

        print(f"  {len(all_new_opponents)} new opponents — fetching profiles ...")

        opp_list = list(all_new_opponents)
        profile_endpoints = [f"players/{t}" for t in opp_list]
        done = 0

        for ep, data in caller.stream_call(profile_endpoints):
            opp = ep.split("players/")[1].replace("%23", "#")
            done += 1
            print(f"  [{done}/{len(opp_list)}]", end="\r", flush=True)

            if data is None:
                print(f"  ? {opp}  (fetch failed)")
                disqualified.add(opp)
                continue

            rank = data.get("rankedRank")
            rank_name = data.get("rankedRankName", "?")
            name = data.get("name", "?")

            if rank is None or rank < MIN_EXPLORE_RANK:
                disqualified.add(opp)
                continue

            if rank < MIN_RANK_ADD:
                print(f"  ~ {opp:14}  {name:20}  rank={rank} ({rank_name})  explore-only")
                enqueue(opp, current_depth + 1)
                continue

            if opp not in tags:
                tags[opp] = {
                    "name": name,
                    "source": f"explore:depth{current_depth+1}:{rank_name}",
                    "added": datetime.now().strftime("%Y-%m-%d"),
                }
                _save_ranked_tags(tags)
                added += 1
                print(f"  + {opp:14}  {name:20}  rank={rank} ({rank_name})")
            else:
                print(f"  ~ {opp:14}  {name:20}  already known, queuing")

            enqueue(opp, current_depth + 1)

            if added >= max_players:
                break

    print(f"\nDone. Added {added} new players  ({len(tags)} total in tags.json)  [{caller.total_calls} API calls]")


def main():
    parser = argparse.ArgumentParser(description="BFS explore ranked players from a seed tag")
    parser.add_argument("--seed", default="#G88882GJ", help="Starting player tag, or 'all' to seed from entire tags.json")
    parser.add_argument("--max-players", type=int, default=50, help="Max new players to add")
    parser.add_argument("--max-depth", type=int, default=4, help="Max BFS depth")
    parser.add_argument("--rate-limit", type=int, default=150, help="Max API calls per minute")
    args = parser.parse_args()

    explore(args.seed, max_players=args.max_players, max_depth=args.max_depth, rate_limit=args.rate_limit)


if __name__ == "__main__":
    main()
