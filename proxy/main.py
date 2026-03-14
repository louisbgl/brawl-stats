"""
Simple proxy service for Brawl Stars API.
Provides a static IP endpoint for GitHub Actions to use.
"""

from flask import Flask, request, jsonify
import requests
import os
from urllib.parse import quote

app = Flask(__name__)

BRAWL_API_BASE = "https://api.brawlstars.com/v1"
API_TOKEN = os.environ.get("BRAWL_STARS_API_TOKEN")

if not API_TOKEN:
    raise ValueError("BRAWL_STARS_API_TOKEN environment variable is required")


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "service": "brawl-stars-proxy"}), 200


@app.route('/<path:endpoint>', methods=['GET'])
def proxy(endpoint):
    """
    Proxy all requests to Brawl Stars API
    Example: /players/%23LLJGJQVY -> https://api.brawlstars.com/v1/players/%23LLJGJQVY
    """
    # Flask decodes the URL, but we need to keep player tags encoded
    # Re-encode the endpoint to preserve %23 as %23 (not #)
    # Split by '/' and encode each part
    parts = endpoint.split('/')
    encoded_parts = [quote(part, safe='') for part in parts]
    encoded_endpoint = '/'.join(encoded_parts)

    # Build the full URL
    url = f"{BRAWL_API_BASE}/{encoded_endpoint}"

    # Forward query parameters
    params = request.args.to_dict()

    # Add authorization header
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Accept": "application/json"
    }

    try:
        # Make the request to Brawl Stars API
        response = requests.get(url, headers=headers, params=params, timeout=10)

        # Return the response with same status code
        return jsonify(response.json()), response.status_code

    except requests.exceptions.RequestException as e:
        return jsonify({
            "error": "Proxy request failed",
            "details": str(e)
        }), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
