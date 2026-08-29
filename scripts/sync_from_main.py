#!/usr/bin/env python3
"""
Sync data from main branch to v2 structure.

Automates the process of pulling new snapshots/battlelogs from main branch,
converting to v2's compressed structure, and regenerating aggregated data.

Usage:
    python scripts/sync_from_main.py --dry-run    # Show what would happen
    python scripts/sync_from_main.py --execute    # Actually sync data
"""

import argparse
import subprocess
import sys
import os
import shutil
from pathlib import Path
from typing import List, Dict, Set, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime


@dataclass
class FileDiff:
    """Represents difference between main and v2 data"""
    new_snapshots: List[str]      # Dates of new snapshots (YYYY-MM-DD)
    new_battlelogs: List[str]      # New player tags (not in v2)
    updated_battlelogs: List[str]  # Existing player tags with different hash
    unchanged_snapshots: int       # Count of snapshots already in v2
    unchanged_battlelogs: int      # Count of battlelogs already in v2


class MainSyncTool:
    """Tool to sync data from main branch to v2 structure"""

    def __init__(self, dry_run: bool = True):
        self.dry_run = dry_run
        self.root = Path(__file__).parent.parent
        self.changes: List[str] = []
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.temp_dir: Optional[Path] = None

    def run(self) -> bool:
        """Main execution flow"""
        print("=" * 60)
        print(f"MAIN → V2 SYNC {'(DRY RUN)' if self.dry_run else '(EXECUTE)'}")
        print("=" * 60)
        print()

        # Phase 1: Discovery
        print("[Phase 1] Discovering changes from main branch...")
        diff = self.discover_changes()
        if diff is None:
            self._report_errors()
            return False

        print()
        self._report_discovery(diff)

        # Check if anything to sync
        if not diff.new_snapshots and not diff.new_battlelogs and not diff.updated_battlelogs:
            print("\n✓ No new data to sync from main")
            return True

        # Phase 2: Validation
        print("\n[Phase 2] Validating safety conditions...")
        if not self.validate_safety(diff):
            self._report_errors()
            self._report_warnings()
            return False

        if self.warnings:
            print()
            self._report_warnings()

        # Phase 3: Execution
        print("\n[Phase 3] Extracting and compressing files...")
        if not self.execute_sync(diff):
            self._report_errors()
            return False

        # TODO: Phase 4-5
        print("\n[Phase 4-5] Not yet implemented")

        return True

    def discover_changes(self) -> Optional[FileDiff]:
        """Phase 1: Compare main vs v2, find new/updated files"""

        # Fetch origin/main
        print("  Fetching origin/main...")
        try:
            subprocess.run(
                ['git', 'fetch', 'origin', 'main'],
                cwd=self.root,
                check=True,
                capture_output=True
            )
        except subprocess.CalledProcessError as e:
            self.errors.append(f"Git fetch failed: {e.stderr.decode()}")
            return None

        # List snapshots in main
        print("  Listing snapshots in origin/main...")
        main_snapshots = self._list_main_snapshots()
        if main_snapshots is None:
            return None

        # List battlelogs in main with hashes
        print("  Listing battlelogs in origin/main...")
        main_battlelogs = self._list_main_battlelogs_with_hashes()
        if main_battlelogs is None:
            return None

        # List existing v2 snapshots
        v2_snapshots = self._list_v2_snapshots()

        # List existing v2 battlelogs with hashes
        v2_battlelogs = self._list_v2_battlelogs_with_hashes()

        # Calculate diff
        new_snapshots = sorted(set(main_snapshots) - set(v2_snapshots))

        # Battlelogs: separate new vs updated
        new_battlelogs = []
        updated_battlelogs = []
        unchanged_count = 0

        for tag, main_hash in main_battlelogs.items():
            if tag not in v2_battlelogs:
                new_battlelogs.append(tag)  # New player
            elif v2_battlelogs[tag] != main_hash:
                updated_battlelogs.append(tag)  # Hash changed
            else:
                unchanged_count += 1  # Same hash

        return FileDiff(
            new_snapshots=new_snapshots,
            new_battlelogs=sorted(new_battlelogs),
            updated_battlelogs=sorted(updated_battlelogs),
            unchanged_snapshots=len(set(main_snapshots) & set(v2_snapshots)),
            unchanged_battlelogs=unchanged_count
        )

    def _list_main_snapshots(self) -> Optional[List[str]]:
        """Get list of snapshot dates from origin/main:data/snapshots/"""
        try:
            result = subprocess.run(
                ['git', 'ls-tree', '-r', '--name-only', 'origin/main', 'data/snapshots/'],
                cwd=self.root,
                check=True,
                capture_output=True,
                text=True
            )

            # Extract dates from filenames (data/snapshots/YYYY-MM-DD.json)
            dates = []
            for line in result.stdout.strip().split('\n'):
                if line and line.endswith('.json') and not line.endswith('_last_updated.json'):
                    filename = Path(line).name
                    date = filename.replace('.json', '')
                    # Only include YYYY-MM-DD pattern
                    if date.count('-') == 2:
                        dates.append(date)

            return dates

        except subprocess.CalledProcessError as e:
            self.errors.append(f"Failed to list main snapshots: {e.stderr}")
            return None

    def _list_main_battlelogs_with_hashes(self) -> Optional[Dict[str, str]]:
        """Get dict of player tag → git hash from origin/main:data/battlelogs/"""
        try:
            # Use ls-tree to get both name and hash
            result = subprocess.run(
                ['git', 'ls-tree', '-r', 'origin/main', 'data/battlelogs/'],
                cwd=self.root,
                check=True,
                capture_output=True,
                text=True
            )

            # Parse output: <mode> <type> <hash>\t<path>
            tag_hashes = {}
            for line in result.stdout.strip().split('\n'):
                if not line:
                    continue
                parts = line.split()
                if len(parts) >= 3:
                    obj_hash = parts[2]
                    path = parts[3] if len(parts) > 3 else ''

                    if path.endswith('.json') and not path.endswith('_last_updated.json'):
                        filename = Path(path).name
                        tag = filename.replace('.json', '')
                        tag_hashes[tag] = obj_hash

            return tag_hashes

        except subprocess.CalledProcessError as e:
            self.errors.append(f"Failed to list main battlelogs: {e.stderr}")
            return None

    def _list_v2_snapshots(self) -> List[str]:
        """Get list of snapshot dates from data/raw/snapshots/"""
        snapshots_dir = self.root / "data" / "raw" / "snapshots"
        if not snapshots_dir.exists():
            return []

        dates = []
        for file in snapshots_dir.glob("*.json.gz"):
            date = file.stem.replace('.json', '')
            dates.append(date)

        return dates

    def _list_v2_battlelogs_with_hashes(self) -> Dict[str, str]:
        """Get dict of player tag → content hash from data/raw/battlelogs/"""
        import hashlib
        import gzip

        battlelogs_dir = self.root / "data" / "raw" / "battlelogs"
        if not battlelogs_dir.exists():
            return {}

        tag_hashes = {}
        for file in battlelogs_dir.glob("*.json.gz"):
            tag = file.stem.replace('.json', '')

            # Hash uncompressed content (to match git hash)
            with gzip.open(file, 'rb') as f:
                content = f.read()
                # Git blob hash = sha1("blob <size>\0<content>")
                blob_header = f"blob {len(content)}\0".encode()
                git_hash = hashlib.sha1(blob_header + content).hexdigest()
                tag_hashes[tag] = git_hash

        return tag_hashes

    def validate_safety(self, diff: FileDiff) -> bool:
        """Phase 2: Validate safety conditions before sync"""

        all_safe = True

        # 1. Git state clean
        print("  Checking git state...")
        try:
            result = subprocess.run(
                ['git', 'status', '--porcelain'],
                cwd=self.root,
                check=True,
                capture_output=True,
                text=True
            )
            if result.stdout.strip():
                self.errors.append("Git working directory has uncommitted changes")
                all_safe = False
            else:
                print("    ✓ Git state clean")
        except subprocess.CalledProcessError as e:
            self.errors.append(f"Failed to check git status: {e.stderr}")
            all_safe = False

        # 2. Check for merge/rebase in progress
        git_dir = self.root / ".git"
        if (git_dir / "MERGE_HEAD").exists():
            self.errors.append("Git merge in progress, resolve before syncing")
            all_safe = False
        elif (git_dir / "rebase-merge").exists() or (git_dir / "rebase-apply").exists():
            self.errors.append("Git rebase in progress, resolve before syncing")
            all_safe = False
        else:
            print("    ✓ No merge/rebase in progress")

        # 3. Disk space check
        print("  Checking disk space...")
        try:
            stat = shutil.disk_usage(self.root)
            free_mb = stat.free / (1024 * 1024)
            if free_mb < 500:
                self.warnings.append(f"Low disk space: {free_mb:.0f} MB free")
            print(f"    ✓ {free_mb:.0f} MB free")
        except Exception as e:
            self.warnings.append(f"Could not check disk space: {e}")

        # 4. Dependencies available
        print("  Checking dependencies...")
        try:
            subprocess.run(['gzip', '--version'], check=True, capture_output=True)
            print("    ✓ gzip available")
        except (subprocess.CalledProcessError, FileNotFoundError):
            self.errors.append("gzip command not found (required for compression)")
            all_safe = False

        # 5. V2 structure exists
        print("  Checking v2 structure...")
        snapshots_dir = self.root / "data" / "raw" / "snapshots"
        battlelogs_dir = self.root / "data" / "raw" / "battlelogs"

        if not snapshots_dir.exists():
            self.warnings.append(f"Creating missing directory: {snapshots_dir}")
            if not self.dry_run:
                snapshots_dir.mkdir(parents=True, exist_ok=True)

        if not battlelogs_dir.exists():
            self.warnings.append(f"Creating missing directory: {battlelogs_dir}")
            if not self.dry_run:
                battlelogs_dir.mkdir(parents=True, exist_ok=True)

        print("    ✓ V2 directories exist")

        # 6. Temp dir writable
        print("  Checking temp directory...")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.temp_dir = Path(f"/tmp/brawl-sync-{timestamp}")
        try:
            if not self.dry_run:
                self.temp_dir.mkdir(parents=True, exist_ok=True)
                # Test write
                test_file = self.temp_dir / "test"
                test_file.write_text("test")
                test_file.unlink()
            print(f"    ✓ Temp dir: {self.temp_dir}")
        except Exception as e:
            self.errors.append(f"Cannot create temp directory: {e}")
            all_safe = False

        # 7. Player consistency check
        print("  Checking player consistency...")
        main_battlelogs = self._list_main_battlelogs_with_hashes()
        v2_battlelogs = self._list_v2_battlelogs_with_hashes()

        if main_battlelogs and v2_battlelogs:
            if len(main_battlelogs) < len(v2_battlelogs):
                removed = set(v2_battlelogs.keys()) - set(main_battlelogs.keys())
                self.warnings.append(f"Players in v2 but not main: {', '.join(removed)}")
            print(f"    ✓ {len(main_battlelogs)} players in main, {len(v2_battlelogs)} in v2")

        return all_safe

    def execute_sync(self, diff: FileDiff) -> bool:
        """Phase 3: Extract files from main, compress, copy to v2"""
        import json
        import gzip

        if not self.temp_dir:
            self.errors.append("Temp directory not initialized")
            return False

        all_success = True

        # 1. Extract and compress snapshots
        if diff.new_snapshots:
            print(f"  Extracting {len(diff.new_snapshots)} snapshots...")
            temp_snapshots = self.temp_dir / "snapshots"
            temp_snapshots.mkdir(exist_ok=True)

            for date in diff.new_snapshots:
                src_path = f"data/snapshots/{date}.json"
                temp_file = temp_snapshots / f"{date}.json"
                compressed_file = temp_snapshots / f"{date}.json.gz"

                # Extract from git
                try:
                    result = subprocess.run(
                        ['git', 'show', f'origin/main:{src_path}'],
                        cwd=self.root,
                        check=True,
                        capture_output=True
                    )
                    temp_file.write_bytes(result.stdout)
                except subprocess.CalledProcessError as e:
                    self.errors.append(f"Failed to extract {src_path}: {e.stderr.decode()}")
                    all_success = False
                    continue

                # Compress with gzip -9
                try:
                    subprocess.run(
                        ['gzip', '-9', str(temp_file)],
                        check=True,
                        capture_output=True
                    )
                except subprocess.CalledProcessError as e:
                    self.errors.append(f"Failed to compress {date}.json: {e.stderr.decode()}")
                    all_success = False
                    continue

                # Copy to v2 (unless dry-run)
                if not self.dry_run:
                    dest = self.root / "data" / "raw" / "snapshots" / f"{date}.json.gz"
                    shutil.copy2(compressed_file, dest)
                    print(f"    ✓ {date}.json.gz")
                else:
                    print(f"    [dry-run] Would copy {date}.json.gz")

        # 2. Extract and compress battlelogs
        all_battlelogs = diff.new_battlelogs + diff.updated_battlelogs
        if all_battlelogs:
            print(f"  Extracting {len(all_battlelogs)} battlelogs...")
            temp_battlelogs = self.temp_dir / "battlelogs"
            temp_battlelogs.mkdir(exist_ok=True)

            for tag in all_battlelogs:
                src_path = f"data/battlelogs/{tag}.json"
                temp_file = temp_battlelogs / f"{tag}.json"
                compressed_file = temp_battlelogs / f"{tag}.json.gz"

                # Extract from git
                try:
                    result = subprocess.run(
                        ['git', 'show', f'origin/main:{src_path}'],
                        cwd=self.root,
                        check=True,
                        capture_output=True
                    )
                    temp_file.write_bytes(result.stdout)
                except subprocess.CalledProcessError as e:
                    self.errors.append(f"Failed to extract {src_path}: {e.stderr.decode()}")
                    all_success = False
                    continue

                # Compress with gzip -9
                try:
                    subprocess.run(
                        ['gzip', '-9', str(temp_file)],
                        check=True,
                        capture_output=True
                    )
                except subprocess.CalledProcessError as e:
                    self.errors.append(f"Failed to compress {tag}.json: {e.stderr.decode()}")
                    all_success = False
                    continue

                # Copy to v2 (unless dry-run)
                if not self.dry_run:
                    dest = self.root / "data" / "raw" / "battlelogs" / f"{tag}.json.gz"
                    shutil.copy2(compressed_file, dest)
                    print(f"    ✓ {tag}.json.gz")
                else:
                    print(f"    [dry-run] Would copy {tag}.json.gz")

        # 3. Update metadata files
        print("  Updating metadata files...")

        # Snapshot metadata
        try:
            result = subprocess.run(
                ['git', 'show', 'origin/main:data/snapshots/_last_updated.json'],
                cwd=self.root,
                check=True,
                capture_output=True,
                text=True
            )
            snapshot_meta = json.loads(result.stdout)

            if not self.dry_run:
                meta_path = self.root / "data" / "raw" / "metadata" / "snapshots.json"
                meta_path.write_text(json.dumps(snapshot_meta, indent=2) + '\n')
                print(f"    ✓ snapshots.json updated")
            else:
                print(f"    [dry-run] Would update snapshots.json")
        except subprocess.CalledProcessError as e:
            self.warnings.append(f"Could not extract snapshot metadata: {e.stderr.decode()}")
        except Exception as e:
            self.warnings.append(f"Could not update snapshot metadata: {e}")

        # Battlelog metadata
        try:
            result = subprocess.run(
                ['git', 'show', 'origin/main:data/battlelogs/_last_updated.json'],
                cwd=self.root,
                check=True,
                capture_output=True,
                text=True
            )
            battlelog_meta = json.loads(result.stdout)

            if not self.dry_run:
                meta_path = self.root / "data" / "raw" / "metadata" / "battlelogs.json"
                meta_path.write_text(json.dumps(battlelog_meta, indent=2) + '\n')
                print(f"    ✓ battlelogs.json updated")
            else:
                print(f"    [dry-run] Would update battlelogs.json")
        except subprocess.CalledProcessError as e:
            self.warnings.append(f"Could not extract battlelog metadata: {e.stderr.decode()}")
        except Exception as e:
            self.warnings.append(f"Could not update battlelog metadata: {e}")

        # 4. Cleanup temp dir on success
        if all_success and not self.dry_run:
            try:
                shutil.rmtree(self.temp_dir)
                print(f"  ✓ Cleaned up temp directory")
            except Exception as e:
                self.warnings.append(f"Could not cleanup temp dir: {e}")
        elif not all_success:
            print(f"  ⚠ Temp directory preserved for debugging: {self.temp_dir}")

        return all_success

    def _report_discovery(self, diff: FileDiff):
        """Print discovery results"""
        print(f"\n  Snapshots:")
        print(f"    New: {len(diff.new_snapshots)}")
        if diff.new_snapshots:
            print(f"      {', '.join(diff.new_snapshots)}")
        print(f"    Unchanged: {diff.unchanged_snapshots}")

        print(f"\n  Battlelogs:")
        print(f"    New players: {len(diff.new_battlelogs)}")
        if diff.new_battlelogs:
            print(f"      {', '.join(diff.new_battlelogs)}")
        print(f"    Updated: {len(diff.updated_battlelogs)}")
        if diff.updated_battlelogs:
            print(f"      {', '.join(diff.updated_battlelogs)}")
        print(f"    Unchanged: {diff.unchanged_battlelogs}")

    def _report_errors(self):
        """Print errors"""
        if self.errors:
            print("\n✗ Errors:")
            for error in self.errors:
                print(f"  - {error}")

    def _report_warnings(self):
        """Print warnings"""
        if self.warnings:
            print("\n⚠ Warnings:")
            for warning in self.warnings:
                print(f"  - {warning}")


def main():
    parser = argparse.ArgumentParser(
        description='Sync data from main branch to v2 structure',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --dry-run     Show what would be synced
  %(prog)s --execute     Actually sync data from main
        """
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--dry-run', action='store_true', help='Show what would happen without making changes')
    group.add_argument('--execute', action='store_true', help='Actually perform the sync')

    args = parser.parse_args()

    tool = MainSyncTool(dry_run=args.dry_run)
    success = tool.run()

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
