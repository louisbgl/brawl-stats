"""Compression utilities for JSON data files.

Shared utilities for compressing/decompressing JSON files using gzip.
Used by both collection scripts (save compressed) and aggregation scripts (read compressed).
"""

import gzip
import json
from pathlib import Path
from typing import Any


def save_compressed(data: Any, filepath: str | Path, compresslevel: int = 9) -> None:
    """Save data as gzipped JSON.

    Args:
        data: Python object to serialize (dict, list, etc.)
        filepath: Output path (should end in .json.gz)
        compresslevel: Compression level 1-9 (9 = max compression, slower)

    Example:
        save_compressed({"foo": "bar"}, "data/raw/snapshots/2026-08-25.json.gz")
    """
    filepath = Path(filepath)
    filepath.parent.mkdir(parents=True, exist_ok=True)

    with gzip.open(filepath, 'wt', encoding='utf-8', compresslevel=compresslevel) as f:
        json.dump(data, f, separators=(',', ':'), ensure_ascii=False)


def load_compressed(filepath: str | Path) -> Any:
    """Load data from gzipped JSON.

    Args:
        filepath: Path to .json.gz file

    Returns:
        Deserialized Python object

    Example:
        data = load_compressed("data/raw/snapshots/2026-08-25.json.gz")
    """
    filepath = Path(filepath)

    with gzip.open(filepath, 'rt', encoding='utf-8') as f:
        return json.load(f)


def get_compressed_size(filepath: str | Path) -> int:
    """Get size of compressed file in bytes.

    Args:
        filepath: Path to .json.gz file

    Returns:
        File size in bytes
    """
    filepath = Path(filepath)
    return filepath.stat().st_size if filepath.exists() else 0


def get_compression_ratio(original_size: int, compressed_size: int) -> float:
    """Calculate compression ratio.

    Args:
        original_size: Uncompressed size in bytes
        compressed_size: Compressed size in bytes

    Returns:
        Compression ratio (e.g., 0.92 = 92% reduction)
    """
    if original_size == 0:
        return 0.0
    return 1.0 - (compressed_size / original_size)


def verify_compression_integrity(
    original_data: Any,
    filepath: str | Path
) -> tuple[bool, str]:
    """Verify that compressed data matches original.

    Args:
        original_data: Original Python object
        filepath: Path to compressed file

    Returns:
        (success, message) tuple

    Example:
        data = {"foo": "bar"}
        save_compressed(data, "test.json.gz")
        success, msg = verify_compression_integrity(data, "test.json.gz")
    """
    try:
        loaded_data = load_compressed(filepath)

        if original_data == loaded_data:
            return True, "Data matches (integrity verified)"
        else:
            return False, "Data mismatch after decompression"

    except Exception as e:
        return False, f"Verification failed: {e}"
