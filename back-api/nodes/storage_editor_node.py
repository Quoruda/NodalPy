"""Storage Editor Node — Clean, safe storage maintenance for NodalPy.

This module provides utilities to inspect, report on, and safely clean up
the storage directory (storage/) by identifying orphaned UUID folders and
orphaned files without touching active graph nodes.

Usage:
    from back_api.nodes.storage_editor_node import scan_storage, safe_cleanup

    # Scan-only mode
    report = scan_storage()
    print(report)

    # Dry-run cleanup preview
    clean_report = safe_cleanup(storage_root, active_uuids, dry_run=True)

    # Actual cleanup (use with caution!)
    clean_report = safe_cleanup(storage_root, active_uuids, dry_run=False)
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# ---------------------------------------------------------------------------
# Constants & Paths
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent  # back-api/
STORAGE_ROOT = BASE_DIR.parent / "storage"         # NodalPy/storage/
REGISTRY_PATH = STORAGE_ROOT / ".registry.json"     # Optional registry file
CLEANUP_LOG_PATH = STORAGE_ROOT / ".cleanup.log"    # Audit trail


# ---------------------------------------------------------------------------
# Utility: read / write the optional JSON registry
# ---------------------------------------------------------------------------

def _read_registry() -> dict[str, Any]:
    """Load the storage registry JSON if it exists; return empty dict otherwise."""
    try:
        with REGISTRY_PATH.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _write_registry(data: dict[str, Any]) -> None:
    """Persist the registry to disk."""
    with REGISTRY_PATH.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=4)


# ---------------------------------------------------------------------------
# 1. scan_storage() — exhaustive directory scan
# ---------------------------------------------------------------------------

def scan_storage(storage_root: Path | None = None) -> dict[str, Any]:
    """Scan the storage directory and return a structured report.

    This is a read-only operation — no files are modified.

    Returns a dictionary with keys:
        total_uuids       (int)      — number of UUID folders found
        active_uuids      (list[str])— list of active node IDs (empty if graph integration not configured)
        orphaned_uuids    (list[str])— UUIDs on disk that are NOT in the active set
        empty_folders     (list[str])— paths to folders with zero files
        folders_with_files(list[dict])— folders containing files, each dict has 'uuid' and 'files'
        total_size_bytes  (int)      — combined size of all files on disk
    """
    root = storage_root or STORAGE_ROOT

    if not root.exists():
        return {
            "total_uuids": 0,
            "active_uuids": [],
            "orphaned_uuids": [],
            "empty_folders": [],
            "folders_with_files": [],
            "total_size_bytes": 0,
        }

    total_uuids = 0
    orphaned_uuids: list[str] = []
    empty_folders: list[str] = []
    folders_with_files: list[dict[str, Any]] = []
    total_size_bytes = 0

    # Collect active UUIDs from graph integration if available
    active_uuids_set = get_active_node_uuids()

    for entry in sorted(root.iterdir()):
        if not entry.is_dir():
            continue

        files = [f.name for f in entry.iterdir() if f.is_file()]
        total_size_bytes += sum(f.stat().st_size for f in entry.iterdir() if f.is_file())
        total_uuids += 1

        # Determine orphan status
        is_orphaned = entry.name not in active_uuids_set

        if is_orphaned:
            orphaned_uuids.append(entry.name)

        if not files:
            empty_folders.append(str(entry))
        else:
            folders_with_files.append({
                "uuid": entry.name,
                "file_count": len(files),
                "files": files,
                "size_bytes": sum(f.stat().st_size for f in entry.iterdir() if f.is_file()),
                "is_orphaned_uuid": is_orphaned,
            })

    return {
        "total_uuids": total_uuids,
        "active_uuids": sorted(active_uuids_set),
        "orphaned_uuids": sorted(orphaned_uuids),
        "empty_folders": empty_folders,
        "folders_with_files": folders_with_files,
        "total_size_bytes": total_size_bytes,
    }


# ---------------------------------------------------------------------------
# 2. delete_empty_folders() — safe removal of identified empty dirs
# ---------------------------------------------------------------------------

def delete_empty_folders(
    folder_paths: list[str],
    dry_run: bool = False,
) -> dict[str, Any]:
    """Delete the specified empty folders.

    Args:
        folder_paths: Absolute paths to empty UUID directories.
        dry_run:      If True, only report what *would* be deleted.

    Returns:
        A dict with keys 'deleted' (list), 'skipped' (list), 'errors' (list).
    """
    result = {"deleted": [], "skipped": [], "errors": []}

    for folder_path_str in folder_paths:
        folder = Path(folder_path_str)

        if not folder.exists() or any(folder.iterdir()):
            # Already gone or no longer empty — skip silently
            result["skipped"].append(folder_path_str)
            continue

        if dry_run:
            result["deleted"].append(folder_path_str + " (DRY-RUN)")
            logger.info("[DRY-RUN] Would delete empty folder: %s", folder_path_str)
            continue

        try:
            shutil.rmtree(folder, ignore_errors=True)
            result["deleted"].append(str(folder))
            logger.info("Deleted empty folder: %s", folder_path_str)
        except Exception as exc:  # noqa: BLE001
            msg = f"Cannot delete {folder_path_str}: {exc}"
            result["errors"].append(msg)
            logger.error("[ERROR] %s", msg)

    return result


# ---------------------------------------------------------------------------
# 3. get_active_node_uuids() — abstract hook for graph integration
# ---------------------------------------------------------------------------

def get_active_node_uuids(storage_root: Path | None = None) -> set[str]:
    """Return the set of UUID strings that represent active nodes in the current graph.

    This is an *abstract* function — by default it returns an empty set because
    this module does not depend on any specific graph engine.  If you have a
    running graph object you can override or extend this method.

    Subclass / monkey-patch strategy:
        >>> import back_api.nodes.storage_editor_node as se
        >>> se.get_active_node_uuids = lambda: {"uuid-1", "uuid-2"}

    Or pass the ``active_uuids`` parameter to :func:`safe_cleanup` directly
    instead of relying on this hook.
    """
    # Default: no graph integration — return empty set.
    # To integrate with your actual graph, replace this body or monkey-patch.
    try:
        registry = _read_registry()
        active_nodes = registry.get("active_nodes", {})
        return {
            uuid for uuid, info in active_nodes.items()
            if isinstance(info, dict) and info.get("status") == "active"
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to read registry for active nodes: %s", exc)

    return set()


# ---------------------------------------------------------------------------
# 4. get_node_referenced_files() — abstract hook for file reference resolution
# ---------------------------------------------------------------------------

def get_node_referenced_files(uuid_id: str, storage_root: Path | None = None) -> list[str]:
    """Return the filenames that are legitimately referenced by a given node.

    This is an *abstract* function — override or monkey-patch in your own code
    to reflect how NodalPy tracks file references per node (e.g., via database,
    graph edge data, or JSON manifests).

    Default implementation returns all files found on disk for the folder,
    meaning nothing will ever be considered "orphaned" at the file level.
    """
    root = storage_root or STORAGE_ROOT
    folder = root / uuid_id
    if not folder.is_dir():
        return []
    return [f.name for f in folder.iterdir() if f.is_file()]


# ---------------------------------------------------------------------------
# 5. safe_cleanup() — main cleanup orchestration
# ---------------------------------------------------------------------------

def safe_cleanup(
    storage_root: Path | None = None,
    active_node_uuids: set[str] | None = None,
    dry_run: bool = True,
) -> dict[str, Any]:
    """Perform a safe cleanup of the storage directory.

    Algorithm:
        1. Identify orphaned UUID folders (on disk but not in active graph).
           - If empty → delete (or mark for deletion in dry-run).
           - If non-empty → keep folder, scan files individually.
        2. For every active UUID folder, identify files that are NOT referenced
           by the node and remove them.

    IMPORTANT: The "golden rule" is **never** delete a folder belonging to an
    active graph node. Only orphaned folders/files are touched.

    Args:
        storage_root:      Path to the storage directory (default: STORAGE_ROOT).
        active_node_uuids: Explicit set of active UUIDs; overrides the hook.
        dry_run:           If True, only report what *would* happen — no writes.

    Returns:
        A detailed report dictionary with keys:
            uuids_deleted      (list[str])   — orphaned folders removed
            files_removed      (list[str])   — orphaned files removed
            skipped            (list[str])   — items already gone / safe to skip
            errors             (list[str])   — any exceptions encountered
            dry_run            (bool)        — echo of the flag
    """
    root = storage_root or STORAGE_ROOT

    if active_node_uuids is None:
        active_node_uuids = get_active_node_uuids(root)

    report = {
        "dry_run": dry_run,
        "uuids_deleted": [],
        "files_removed": [],
        "skipped": [],
        "errors": [],
    }

    if not root.exists():
        logger.warning("Storage root does not exist: %s", root)
        return report

    timestamp = datetime.now(timezone.utc).isoformat()

    # --- Phase A: orphaned UUID folders -----------------------------------
    for entry in sorted(root.iterdir()):
        if not entry.is_dir():
            continue

        uuid_name = entry.name
        is_orphaned = uuid_name not in active_node_uuids

        if is_orphaned:
            files_in_folder = [f for f in entry.iterdir() if f.is_file()]

            if not files_in_folder:
                # Empty orphan folder → safe to remove
                action_str = "DRY-RUN" if dry_run else "DELETE"
                logger.info("[%s] Orphaned empty UUID folder: %s", action_str, uuid_name)
                report["uuids_deleted"].append(str(entry))

                if not dry_run:
                    try:
                        shutil.rmtree(entry, ignore_errors=True)
                        _log_cleanup_action("delete_folder", str(entry), timestamp)
                    except Exception as exc:  # noqa: BLE001
                        msg = f"Cannot delete orphaned folder {entry}: {exc}"
                        report["errors"].append(msg)
                        logger.error("[ERROR] %s", msg)

            else:
                # Non-empty orphan folder → keep it for now, log a warning
                report["skipped"].append(f"{uuid_name} (non-empty orphan, {len(files_in_folder)} files)")
                logger.warning(
                    "Non-empty orphaned UUID folder left intact: %s (%d files)",
                    uuid_name, len(files_in_folder),
                )

        else:
            # --- Phase B: active node — check for file-level orphans --------
            files_on_disk = [f.name for f in entry.iterdir() if f.is_file()]
            referenced_files = get_node_referenced_files(uuid_name, root)
            referenced_set = set(referenced_files)

            orphaned_in_folder = set(files_on_disk) - referenced_set

            if orphaned_in_folder:
                logger.info(
                    "Orphaned files in active UUID %s: %s",
                    uuid_name, sorted(orphaned_in_folder),
                )

                for filename in sorted(orphaned_in_folder):
                    file_path = entry / filename
                    action_str = f"DRY-RUN: {filename}" if dry_run else filename
                    report["files_removed"].append(str(file_path))
                    logger.info("[%s] Orphaned file: %s", action_str, file_path)

                    if not dry_run:
                        try:
                            file_path.unlink()
                            _log_cleanup_action("delete_file", str(file_path), timestamp)
                        except Exception as exc:  # noqa: BLE001
                            msg = f"Cannot delete orphaned file {file_path}: {exc}"
                            report["errors"].append(msg)
                            logger.error("[ERROR] %s", msg)

    return report


# ---------------------------------------------------------------------------
# 6. _log_cleanup_action() — audit trail writer
# ---------------------------------------------------------------------------

def _log_cleanup_action(action: str, path: str, timestamp: str) -> None:
    """Append a single cleanup event to the .cleanup.log audit file."""
    log_entry = json.dumps({
        "timestamp": timestamp,
        "action": action,
        "path": path,
    })
    try:
        with CLEANUP_LOG_PATH.open("a", encoding="utf-8") as fh:
            fh.write(log_entry + "\n")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to write cleanup log entry: %s", exc)


# ---------------------------------------------------------------------------
# 7. format_report() — human-readable summary string
# ---------------------------------------------------------------------------

def format_report(report: dict[str, Any], storage_root: Path | None = None) -> str:
    """Format a scan/cleanup report into a readable multi-line string."""
    root = storage_root or STORAGE_ROOT

    if not report.get("total_uuids") and "orphaned_uuids" in report:
        # This is a cleanup report, build summary from its contents
        lines = [
            "=" * 60,
            "  Storage Cleanup Report",
            "=" * 60,
            f"  Dry Run       : {report['dry_run']}",
            f"  UUIDs Deleted : {len(report['uuids_deleted'])}",
            f"  Files Removed : {len(report['files_removed'])}",
            f"  Skipped       : {len(report['skipped'])}",
            f"  Errors        : {len(report['errors'])}",
            "-" * 60,
        ]

        if report["uuids_deleted"]:
            lines.append("Deleted UUID folders:")
            for p in report["uuids_deleted"]:
                lines.append(f"  - {p}")
            lines.append("")

        if report["files_removed"]:
            # Group by folder
            by_folder: dict[str, list[str]] = {}
            for fpath in report["files_removed"]:
                parent = Path(fpath).parent.name
                fname = Path(fpath).name
                by_folder.setdefault(parent, []).append(fname)

            lines.append("Removed orphaned files:")
            for folder_uuid, filenames in sorted(by_folder.items()):
                lines.append(f"  {folder_uuid}/")
                for fn in filenames:
                    lines.append(f"    - {fn}")
            lines.append("")

        if report["skipped"]:
            lines.append("Skipped items:")
            for item in report["skipped"]:
                lines.append(f"  ⏭ {item}")
            lines.append("")

        if report["errors"]:
            lines.append("Errors encountered:")
            for err in report["errors"]:
                lines.append(f"  ❌ {err}")
            lines.append("")

        # Post-cleanup storage size
        total_size = _get_storage_total_size(root)
        lines.extend([
            "-" * 60,
            f"  Storage size after cleanup: {_format_bytes(total_size)}",
            "=" * 60,
        ])

    else:
        # This is a scan report (from scan_storage)
        total_uuids = report.get("total_uuids", 0)
        orphaned = report.get("orphaned_uuids", [])
        empty = report.get("empty_folders", [])
        files_info = report.get("folders_with_files", [])

        lines = [
            "=" * 60,
            "  Storage Scan Report",
            "=" * 60,
            f"  Total UUID folders : {total_uuids}",
            f"  Active nodes       : {len(report.get('active_uuids', []))}",
            f"  Orphaned UUIDs     : {len(orphaned)}",
            f"  Empty folders      : {len(empty)}",
            f"  Total disk size    : {_format_bytes(_get_storage_total_size(root))}",
            "-" * 60,
        ]

        if orphaned:
            lines.append("\nOrphaned UUIDs:")
            for uid in sorted(orphaned):
                lines.append(f"  - {uid}")
            lines.append("")

        if empty:
            lines.append(f"\nEmpty folders ({len(empty)}):")
            for fp in empty[:20]:  # cap display
                lines.append(f"  - {fp}")
            if len(empty) > 20:
                lines.append(f"  ... and {len(empty) - 20} more")
            lines.append("")

        if files_info:
            orphaned_folders = [f for f in files_info if f.get("is_orphaned_uuid")]
            if orphaned_folders:
                lines.append("\nOrphaned folders with files:")
                for fi in orphaned_folders[:20]:
                    lines.append(f"  - {fi['uuid']} ({fi['file_count']} files, {_format_bytes(fi.get('size_bytes', 0))})")
                if len(orphaned_folders) > 20:
                    lines.append(f"  ... and {len(orphaned_folders) - 20} more")
            lines.append("")

        # Estimate savings (rough): empty folders take ~4KB each, plus orphan file sizes
        estimated_savings = len(empty) * 4096 + sum(
            fi.get("size_bytes", 0) for fi in files_info if fi.get("is_orphaned_uuid")
        )
        lines.extend([
            "-" * 60,
            f"  Estimated reclaimable space: {_format_bytes(estimated_savings)}",
            "=" * 60,
        ])

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_storage_total_size(storage_root: Path | None = None) -> int:
    """Sum the byte size of all files under storage_root."""
    root = storage_root or STORAGE_ROOT
    total = 0
    if root.exists():
        for entry in root.rglob("*"):
            if entry.is_file():
                try:
                    total += entry.stat().st_size
                except OSError:
                    pass
    return total


def _format_bytes(size_bytes: int) -> str:
    """Format a byte count into a human-readable string."""
    for unit in ("B", "KB", "MB", "GB"):
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


# ---------------------------------------------------------------------------
# CLI entry point (python -m back_api.nodes.storage_editor_node)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="NodalPy Storage Editor — inspect and clean orphaned storage",
    )
    parser.add_argument(
        "action",
        choices=["scan", "dry-run", "clean"],
        help="Action to perform: scan (read-only), dry-run (preview cleanup), clean (execute)",
    )
    parser.add_argument(
        "--storage-root",
        type=Path,
        default=None,
        help=f"Override storage directory (default: {STORAGE_ROOT})",
    )
    args = parser.parse_args()

    root = args.storage_root or STORAGE_ROOT
    dry_run = args.action in ("scan", "dry-run")

    if args.action == "scan":
        report = scan_storage(root)
        # Enrich with cleanup info for a fuller picture
        report.update(safe_cleanup(root, dry_run=True))
        print(format_report(report, root))

    elif args.action == "dry-run":
        clean_report = safe_cleanup(root, dry_run=True)
        print(format_report(clean_report, root))

    else:  # clean
        confirm = input(
            "\n⚠️  WARNING: This will DELETE orphaned storage folders and files.\n"
            "Type 'YES' to proceed: "
        )
        if confirm.strip() != "YES":
            print("Aborted.")
        else:
            # Backup registry before cleanup
            registry_before = _read_registry()
            clean_report = safe_cleanup(root, dry_run=False)
            print(format_report(clean_report, root))
