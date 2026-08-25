#!/usr/bin/env python3
"""
Migration script: Compress existing .json files to .json.gz

Compresses all snapshots and battlelogs on v2 branch.
Verifies integrity before deleting originals.

Run this after pulling new data from main to compress uncompressed files.
"""

import json
import sys
from pathlib import Path

# Add parent directory to path for src imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from src.aggregation.compression import (
    save_compressed,
    load_compressed,
    get_compressed_size,
    get_compression_ratio,
    verify_compression_integrity
)


def migrate_file(json_path: Path, dry_run: bool = False) -> tuple[bool, str]:
    """
    Compress a single .json file to .json.gz and verify.

    Args:
        json_path: Path to .json file
        dry_run: If True, don't delete original

    Returns:
        (success, message) tuple
    """
    gz_path = json_path.with_suffix('.json.gz')

    # Skip if already compressed
    if gz_path.exists():
        return True, f"Already compressed (skipped)"

    # Load original data
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        return False, f"Failed to load: {e}"

    # Calculate original size
    original_size = json_path.stat().st_size

    # Save compressed
    try:
        save_compressed(data, gz_path)
    except Exception as e:
        return False, f"Failed to compress: {e}"

    # Verify integrity
    success, msg = verify_compression_integrity(data, gz_path)
    if not success:
        gz_path.unlink()  # Delete bad compressed file
        return False, f"Integrity check failed: {msg}"

    # Calculate compression stats
    compressed_size = get_compressed_size(gz_path)
    ratio = get_compression_ratio(original_size, compressed_size)

    # Delete original (unless dry run)
    if not dry_run:
        json_path.unlink()

    return True, f"Compressed: {original_size/1024:.1f} KB → {compressed_size/1024:.1f} KB ({ratio*100:.1f}% reduction)"


def migrate_directory(dir_path: Path, pattern: str, dry_run: bool = False):
    """
    Migrate all matching files in a directory.

    Args:
        dir_path: Directory to scan
        pattern: Glob pattern (e.g., "*.json")
        dry_run: If True, don't delete originals
    """
    if not dir_path.exists():
        print(f"Directory not found: {dir_path}")
        return

    files = list(dir_path.glob(pattern))
    if not files:
        print(f"No files matching {pattern} in {dir_path}")
        return

    print(f"\nMigrating {len(files)} files in {dir_path}:")
    print("-" * 80)

    success_count = 0
    skip_count = 0
    fail_count = 0
    total_original_size = 0
    total_compressed_size = 0

    for i, file_path in enumerate(sorted(files), 1):
        # Skip metadata files
        if file_path.name.startswith('_'):
            print(f"[{i}/{len(files)}] {file_path.name}: Skipped (metadata)")
            skip_count += 1
            continue

        print(f"[{i}/{len(files)}] {file_path.name}...", end=" ")

        success, msg = migrate_file(file_path, dry_run)

        if "Already compressed" in msg:
            print(msg)
            skip_count += 1
        elif success:
            print(f"✓ {msg}")
            success_count += 1

            # Track sizes
            gz_path = file_path.with_suffix('.json.gz')
            if gz_path.exists():
                total_compressed_size += gz_path.stat().st_size
                if not dry_run:
                    # Original deleted, estimate from compression ratio
                    pass
        else:
            print(f"✗ {msg}")
            fail_count += 1

    print("-" * 80)
    print(f"Success: {success_count}, Skipped: {skip_count}, Failed: {fail_count}")

    if total_compressed_size > 0:
        print(f"Total compressed size: {total_compressed_size / 1024 / 1024:.1f} MB")


def main():
    print("=" * 80)
    print("MIGRATION: Compress .json → .json.gz")
    print("=" * 80)

    # Parse args
    dry_run = '--dry-run' in sys.argv
    if dry_run:
        print("DRY RUN MODE: Original files will NOT be deleted")
        print()

    # Migrate snapshots
    snapshots_dir = Path("data/raw/snapshots")
    migrate_directory(snapshots_dir, "*.json", dry_run)

    # Migrate battlelogs
    battlelogs_dir = Path("data/raw/battlelogs")
    migrate_directory(battlelogs_dir, "*.json", dry_run)

    print()
    print("=" * 80)
    print("MIGRATION COMPLETE")
    print("=" * 80)

    if dry_run:
        print("\nRun without --dry-run to delete original files")


if __name__ == "__main__":
    main()
