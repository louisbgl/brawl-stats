"""
Rate-limited API caller for Brawl Stars API.
Designed to be moved to src/api.py later — does not wrap the existing api_call.

Usage:
    from testing.api import ApiCaller
    caller = ApiCaller(rate_limit=150)  # calls/min

    data = caller.call("players/#ABC123")
    results = caller.mass_call(["players/#ABC", "players/#DEF", ...])
    # results: list of (endpoint, data) — data is None on failure
"""

import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent.parent))
from src.config import API_TOKEN, BASE_URL


class ApiCaller:
    def __init__(self, rate_limit: int = 150, workers: int = 10):
        """
        rate_limit: max calls per minute
        workers: max concurrent threads for mass_call
        """
        self.rate_limit = rate_limit
        self.workers = workers
        self._lock = threading.Lock()
        self._call_times: list[float] = []
        self.total_calls = 0

    def _throttle(self):
        """Block until under rate limit, then record the call timestamp."""
        window = 60.0
        with self._lock:
            now = time.monotonic()
            self._call_times = [t for t in self._call_times if now - t < window]
            if len(self._call_times) >= self.rate_limit:
                sleep_for = window - (now - self._call_times[0])
                if sleep_for > 0:
                    time.sleep(sleep_for)
                now = time.monotonic()
                self._call_times = [t for t in self._call_times if now - t < window]
            self._call_times.append(time.monotonic())
            self.total_calls += 1

    def _raw(self, endpoint: str) -> requests.Response:
        """Single HTTP GET. Raises on non-2xx."""
        endpoint = endpoint.replace("#", "%23")
        headers = {"Accept": "application/json"}
        if API_TOKEN:
            headers["Authorization"] = f"Bearer {API_TOKEN}"
        response = requests.get(f"{BASE_URL}/{endpoint}", headers=headers)
        if not response.ok:
            raise Exception(f"{response.status_code} - {response.text}")
        return response

    def call(self, endpoint: str, retries: int = 3) -> dict | None:
        """Single call with retry + backoff. Returns parsed JSON or None on failure."""
        for attempt in range(retries):
            self._throttle()
            try:
                return self._raw(endpoint).json()
            except Exception:
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)  # 1s, 2s
        return None

    def stream_call(self, endpoints: list[str], retries: int = 3):
        """
        Like mass_call but yields (endpoint, data) as each completes.
        Use when you want to process/save results incrementally.
        """
        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            futures = {executor.submit(self.call, ep, retries): ep for ep in endpoints}
            for future in as_completed(futures):
                yield futures[future], future.result()

    def mass_call(self, endpoints: list[str], retries: int = 3) -> list[tuple[str, dict | None]]:
        """
        Fire all endpoints concurrently up to self.workers threads.
        Returns list of (endpoint, data) in same order as input.
        data is None on failure.
        """
        results = [None] * len(endpoints)
        idx = {ep: i for i, ep in enumerate(endpoints)}

        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            futures = {executor.submit(self.call, ep, retries): ep for ep in endpoints}
            for future in as_completed(futures):
                ep = futures[future]
                results[idx[ep]] = (ep, future.result())

        return results
