"""
API client for Brawl Stars API.
Handles all HTTP requests and caching.
"""

import requests
from urllib.parse import quote
from .config import API_TOKEN, BASE_URL


# Cache for brawlers data to avoid repeated API calls
_BRAWLERS_CACHE = None


def api_call(endpoint):
    """Make an API call to Brawl Stars API (or proxy)"""
    headers = {"Accept": "application/json"}

    # Only add auth header if using direct API (not proxy)
    if API_TOKEN:
        headers["Authorization"] = f"Bearer {API_TOKEN}"

    response = requests.get(f"{BASE_URL}/{endpoint}", headers=headers)
    if response.ok:
        return response
    else:
        raise Exception(f"API call failed: {response.status_code} - {response.text}")


def get_all_brawlers_data():
    """Fetch complete brawler data including all available items (cached)"""
    global _BRAWLERS_CACHE
    if _BRAWLERS_CACHE is None:
        response = api_call("brawlers")
        data = response.json()
        _BRAWLERS_CACHE = {brawler['name']: brawler for brawler in data.get('items', [])}
    return _BRAWLERS_CACHE


def fetch_brawlers_reference():
    """Fetch complete brawlers reference data (for brawlers.json)"""
    response = api_call("brawlers")
    return response.json()


def fetch_club_data(tag):
    """Fetch club data from API"""
    encoded_tag = quote(tag)
    response = api_call(f"clubs/{encoded_tag}")
    return response.json()


def fetch_player_data(tag):
    """Fetch player data from API"""
    encoded_tag = quote(tag)
    response = api_call(f"players/{encoded_tag}")
    return response.json()


def get_club_members_tags(club_data):
    """Extract member tags from club data"""
    members = club_data.get('members', [])
    return [member.get('tag') for member in members if 'tag' in member]
