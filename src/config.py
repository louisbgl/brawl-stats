"""
Configuration file for Brawl Stars tracker.
Contains API credentials, player/club tags, and game constants.
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ============================================================================
# API Configuration
# ============================================================================

# Optional: Use proxy URL instead of direct API
# If set, requests go through proxy (which handles auth)
# If not set, uses direct API with token
PROXY_URL = os.getenv("BRAWL_STARS_PROXY_URL")

if PROXY_URL:
    # Using proxy - no token needed locally
    BASE_URL = PROXY_URL
    API_TOKEN = None
else:
    # Direct API access - token required
    BASE_URL = "https://api.brawlstars.com/v1"
    API_TOKEN = os.getenv("BRAWL_STARS_API_TOKEN")
    if not API_TOKEN:
        raise ValueError(
            "BRAWL_STARS_API_TOKEN not found in environment variables. "
            "Either set BRAWL_STARS_API_TOKEN or BRAWL_STARS_PROXY_URL in .env file."
        )


# ============================================================================
# Clubs to Track
# ============================================================================

CLUBS = [
    # Add clubs here as needed:
    # {
    #     "name": "Another Club",
    #     "tag": "#XXXXXXX",
    # },
    {
        "name": "JOEL Club",
        "tag": "#80QPP8V8P",
    },
]


# ============================================================================
# Individual Players to Track (not in clubs above)
# ============================================================================

INDIVIDUAL_PLAYERS = [
    # Add individual players here:
    # {
    #     "name": "Friend Name",
    #     "tag": "#XXXXXXX",
    # },
    {
        "name": "Mathys",
        "tag": "#2LGCLLPU2",
    },
    {
        "name": "Nielsen",
        "tag": "#Q0CQLYCVL",
    }
]


# ============================================================================
# Game Constants
# ============================================================================

# Brawlers that currently have buffies available
BUFFIED_BRAWLERS = [
    "NITA", "CROW", "BULL", "BO", "BIBI", "LEON",
    "SHELLY", "COLT", "SPIKE", "EMZ", "FRANK", "MORTIS"
]

# Power point costs to upgrade brawlers (cumulative from power 1)
POWER_POINTS = {
    1: 0, 2: 20, 3: 50, 4: 100, 5: 180, 6: 310,
    7: 520, 8: 860, 9: 1410, 10: 2300, 11: 3740
}

# Gold costs to upgrade brawlers (per level)
GOLD_COSTS = {
    2: 20, 3: 35, 4: 75, 5: 140, 6: 290, 7: 480,
    8: 800, 9: 1250, 10: 1875, 11: 2800
}

# Gold costs for items
GADGET_COST = 1000
STAR_POWER_COST = 2000
HYPER_CHARGE_COST = 5000
GEAR_COST = 1000  # for the most part (being reworked)
BUFFIE_GOLD_COST = 1000
BUFFIE_PP_COST = 2000


# ============================================================================
# Helper Functions
# ============================================================================

def get_all_tracked_player_tags() -> list[tuple[str, str]]:
    """
    Get all tracked players (club members + individual players).

    Returns:
        List of (tag, name) tuples for all players to track.
        Note: For club members, we need to fetch club data to get current members.
    """
    from .api import fetch_club_data, get_club_members_tags, fetch_player_data

    players = []

    # Get all club members
    for club_config in CLUBS:
        try:
            club_data = fetch_club_data(club_config['tag'])
            member_tags = get_club_members_tags(club_data)

            # Fetch each member to get their name
            for tag in member_tags:
                try:
                    player_data = fetch_player_data(tag)
                    players.append((tag, player_data.get('name', 'Unknown')))
                except Exception:
                    # If we can't fetch player data, still add with unknown name
                    players.append((tag, 'Unknown'))
        except Exception:
            # Skip club if we can't fetch its data
            continue

    # Add individual players
    for player_config in INDIVIDUAL_PLAYERS:
        players.append((player_config['tag'], player_config['name']))

    return players
