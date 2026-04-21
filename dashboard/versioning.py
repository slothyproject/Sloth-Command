"""Runtime version helpers for dashboard and API surfaces.

Provides a stable semantic base version plus optional build metadata
derived from deployment commit SHA so versioning updates automatically
on each deploy.

Mirrors bot/runtime_version.py pattern for consistency.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path


_ROOT = Path(__file__).resolve().parents[1]
_VERSION_JSON = _ROOT / "VERSION.json"
_VERSION_TEXT = _ROOT / "VERSION"


def _base_version() -> str:
    """Read base version from VERSION.json or VERSION file."""
    if _VERSION_JSON.exists():
        try:
            data = json.loads(_VERSION_JSON.read_text(encoding="utf-8"))
            version = str(data.get("version", "")).strip()
            if version:
                return version
        except Exception:
            pass

    if _VERSION_TEXT.exists():
        try:
            version = _VERSION_TEXT.read_text(encoding="utf-8").strip()
            if version:
                return version
        except Exception:
            pass

    return "0.0.0"


def get_dashboard_commit() -> str:
    """Get commit SHA from env, file, or git (in order of preference)."""
    # Try environment variables first
    for env_key in ("RAILWAY_GIT_COMMIT_SHA", "GIT_COMMIT", "SOURCE_COMMIT"):
        value = (os.environ.get(env_key) or "").strip()
        if value and value != "unknown":
            return value[:7]

    # Try reading from commit.txt (created by Dockerfile at build time)
    try:
        commit_file = Path("/tmp/commit.txt")
        if commit_file.exists():
            commit = commit_file.read_text(encoding="utf-8").strip()
            if commit and commit != "unknown":
                return commit[:7]
    except Exception:
        pass

    # Try git subprocess as fallback
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=_ROOT,
            capture_output=True,
            text=True,
            timeout=2,
        )
        if result.returncode == 0:
            commit = result.stdout.strip()
            if commit:
                return commit[:7]
    except Exception:
        pass

    return "unknown"


def get_dashboard_version() -> str:
    """Return version in format '{base_version}+{commit_sha}'.
    
    Returns:
        str: Semantic version with optional build metadata.
             Examples: "1.0.0+a1b2c3d", "1.0.0" (if already has +)
    """
    base = (os.environ.get("APP_VERSION") or "").strip() or _base_version()
    commit = get_dashboard_commit()

    # If already has metadata or no commit, return as-is
    if commit == "unknown" or "+" in base:
        return base

    return f"{base}+{commit}"


_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_BASE = "1.0.0"


def get_dashboard_commit() -> str:
    for env_key in ("RAILWAY_GIT_COMMIT_SHA", "GIT_COMMIT", "SOURCE_COMMIT"):
        value = (os.environ.get(env_key) or "").strip()
        if value:
            return value[:7]

    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            cwd=_ROOT,
            check=False,
        )
        commit = (result.stdout or "").strip()
        if commit:
            return commit
    except Exception:
        pass

    return "unknown"


def get_dashboard_version() -> str:
    base = (os.environ.get("HUB_VERSION") or os.environ.get("APP_VERSION") or "").strip()
    if not base:
        base = _DEFAULT_BASE

    commit = get_dashboard_commit()
    if commit == "unknown" or "+" in base:
        return base
    return f"{base}+{commit}"
