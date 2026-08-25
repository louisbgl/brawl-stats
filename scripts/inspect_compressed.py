#!/usr/bin/env python3
"""
Inspection utility for compressed .json.gz files.

Decompress and display contents with optional pretty-printing.

Usage:
    python scripts/inspect_compressed.py data/raw/snapshots/2026-08-25.json.gz
    python scripts/inspect_compressed.py data/raw/battlelogs/2L0U0PGRL.json.gz --pretty
    python scripts/inspect_compressed.py data/raw/snapshots/2026-08-25.json.gz --stats
"""

import sys
import json
from pathlib import Path

# Add parent directory to path for src imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from src.aggregation.compression import load_compressed, get_compressed_size


def print_stats(filepath: Path, data: any):
    """Print file statistics."""
    compressed_size = get_compressed_size(filepath)

    # Estimate uncompressed size
    uncompressed_json = json.dumps(data, separators=(',', ':')).encode('utf-8')
    uncompressed_size = len(uncompressed_json)

    ratio = 1.0 - (compressed_size / uncompressed_size) if uncompressed_size > 0 else 0.0

    print(f"File: {filepath.name}")
    print(f"Compressed size: {compressed_size / 1024:.1f} KB")
    print(f"Uncompressed size: {uncompressed_size / 1024:.1f} KB")
    print(f"Compression ratio: {ratio * 100:.1f}% reduction")
    print()

    # Type-specific stats
    if isinstance(data, dict):
        print(f"Type: Dictionary ({len(data)} keys)")
        if 'date' in data:
            print(f"Date: {data['date']}")
        if 'timestamp' in data:
            print(f"Timestamp: {data['timestamp']}")
        if 'clubs' in data:
            print(f"Clubs: {len(data['clubs'])}")
        if 'individual_players' in data:
            print(f"Individual players: {len(data['individual_players'])}")
    elif isinstance(data, list):
        print(f"Type: List ({len(data)} items)")
        if data and isinstance(data[0], dict) and 'battleTime' in data[0]:
            print(f"Battle log entries: {len(data)}")
            print(f"First battle: {data[0]['battleTime']}")
            print(f"Last battle: {data[-1]['battleTime']}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/inspect_compressed.py <file.json.gz> [--pretty|--stats]")
        sys.exit(1)

    filepath = Path(sys.argv[1])

    if not filepath.exists():
        print(f"Error: File not found: {filepath}")
        sys.exit(1)

    if not filepath.suffix == '.gz':
        print(f"Error: Expected .json.gz file, got: {filepath.suffix}")
        sys.exit(1)

    # Load data
    try:
        data = load_compressed(filepath)
    except Exception as e:
        print(f"Error loading compressed file: {e}")
        sys.exit(1)

    # Parse flags
    pretty = '--pretty' in sys.argv
    stats = '--stats' in sys.argv

    # Display stats only
    if stats:
        print_stats(filepath, data)
        return

    # Display JSON
    if pretty:
        print(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        print(json.dumps(data, ensure_ascii=False))


if __name__ == "__main__":
    main()
